// SPDX-License-Identifier: BSD-3-Clause
using System.Collections;
using System.Reflection;
using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

if (args.Length != 3) throw new ArgumentException("SourceReader <source.cs> <symbol> <excluded-members>");
var tree = CSharpSyntaxTree.ParseText(File.ReadAllText(args[0]), path: args[0]);
var root = tree.GetRoot();
var matches = root.DescendantNodes().OfType<BaseTypeDeclarationSyntax>().Where(n => n.Identifier.ValueText == args[1]).ToArray();
if (matches.Length != 1) throw new ArgumentException("Select one unambiguous type symbol");
var references = ((string)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES")!).Split(Path.PathSeparator).Select(p => MetadataReference.CreateFromFile(p));
var compilation = CSharpCompilation.Create("Selection", [tree], references, new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
var model = compilation.GetSemanticModel(tree);
object Read(SyntaxNode node)
{
    var fields = new SortedDictionary<string, object?>();
    foreach (var property in node.GetType().GetProperties(BindingFlags.Instance | BindingFlags.Public))
    {
        if (property.GetIndexParameters().Length != 0 || property.Name is "Parent" or "ParentTrivia" or "SyntaxTree") continue;
        var value = property.GetValue(node);
        if (value is SyntaxNode child) fields[property.Name] = Read(child);
        else if (value is SyntaxToken token) fields[property.Name] = token.ValueText;
        else if (value is IEnumerable items && value is not string)
        {
            var children = items.Cast<object>().ToArray();
            if (children.All(x => x is SyntaxNode)) fields[property.Name] = children.Cast<SyntaxNode>().Select(Read).ToArray();
            else if (children.All(x => x is SyntaxToken)) fields[property.Name] = children.Cast<SyntaxToken>().Select(x => x.ValueText).ToArray();
        }
    }
    var symbol = model.GetSymbolInfo(node).Symbol;
    var line = node.GetLocation().GetLineSpan().StartLinePosition;
    return new { kind = node.Kind().ToString(), line = line.Line + 1, column = line.Character + 1, fields,
        symbol = symbol == null ? null : new { kind = symbol.Kind.ToString(), name = symbol.Name, isStatic = symbol.IsStatic, owner = symbol.ContainingType?.Name },
        type = node is ExpressionSyntax expression ? model.GetTypeInfo(expression).Type?.ToDisplayString() : null };
}
var selection = matches[0];
var excluded = args[2].Split(',', StringSplitOptions.RemoveEmptyEntries).ToHashSet();
var excludedSpans = selection.DescendantNodes().OfType<MethodDeclarationSyntax>().Where(m => excluded.Contains(m.Identifier.ValueText)).Select(m => m.Span).ToArray();
Console.WriteLine(JsonSerializer.Serialize(new {
    node = Read(selection),
    dependencies = selection.DescendantNodes().OfType<IdentifierNameSyntax>().Select(n => model.GetSymbolInfo(n).Symbol)
        .Where(s => s != null && s.Kind is SymbolKind.NamedType or SymbolKind.Method or SymbolKind.Property)
        .Select(s => s!.ToDisplayString()).Distinct().Order().ToArray(),
    syntaxDiagnostics = tree.GetDiagnostics().Select(d => d.ToString()).ToArray(),
    semanticDiagnostics = model.GetDiagnostics(selection.Span).Where(d => d.Severity == DiagnosticSeverity.Error && !excludedSpans.Any(s => s.Contains(d.Location.SourceSpan))).Select(d => d.ToString()).ToArray()
}, new JsonSerializerOptions { MaxDepth = 512 }));
