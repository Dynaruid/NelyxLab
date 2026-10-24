// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {emitDart} from './dart-emitter.ts';
import type {Declaration,ModuleRecipe} from './body-ir.ts';

interface Owner {name:string;directory:string;sourceRoot:string}
export interface RequiredPackageExport {package:string;manifest:string;key:string;source:string;entry:{types:string;default:string}}

/** Bind retained imports to their registered producer's package API. The caller
 * reviews and installs returned exports; this function never edits manifests. */
export function bindPackageImports(root:string,module:ModuleRecipe,declarations:Declaration[],manualDeclarations:{file:string;source:string}[]=[]):{module:ModuleRecipe;exports:RequiredPackageExport[]} {
    const result=structuredClone(module),{bind,required}=packageBinder(root,module.destination);
    const output=emitDart(declarations,module,manualDeclarations),parsed=ts.createSourceFile(module.destination,output,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    for(const statement of parsed.statements){
        if(!ts.isImportDeclaration(statement)||!ts.isStringLiteral(statement.moduleSpecifier))continue;
        const previous=statement.moduleSpecifier.text,next=bind(previous);if(previous===next)continue;
        const clause=statement.importClause;
        if(!clause){if(!result.importEmission)throw new Error('Side effect import requires explicit policy');if(!result.importEmission.sideEffects)throw new Error('Unlisted initialization import');result.importEmission.sideEffects=result.importEmission.sideEffects.map(value=>value===previous?next:value);continue;}
        if(clause.name||!clause.namedBindings||!ts.isNamedImports(clause.namedBindings))throw new Error('Unexpected emitted import binding');
        for(const element of clause.namedBindings.elements){const map=clause.isTypeOnly?result.typeImports:result.imports;if(map?.[element.name.text]!==previous)throw new Error('Emitted import differs from recipe catalog');map[element.name.text]=next;}
    }
    // Re-emission validates all catalog requirements and ensures bindings remain
    // part of the recipe rather than a patch to a generated body.
    emitDart(declarations,result,manualDeclarations);
    return {module:result,exports:[...required.values()].sort((a,b)=>(a.package+a.key).localeCompare(b.package+b.key))};
}

function packageBinder(root:string,file:string){
    const registry=JSON.parse(fs.readFileSync(path.join(root,'tools/Nelyx.FrameworkToTypeScript/data/packages.json'),'utf8')) as {packages:Owner[]};
    const sourceRoot=(owner:Owner)=>path.resolve(root,owner.directory,owner.sourceRoot);
    const owns=(owner:Owner,file:string)=>{const relative=path.relative(sourceRoot(owner),file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
    const ownerOf=(file:string)=>{const owners=registry.packages.filter(owner=>owns(owner,file)).sort((a,b)=>sourceRoot(b).length-sourceRoot(a).length);if(!owners.length)throw new Error('No registered source owner: '+file);return owners[0]!;};
    const manifest=(owner:Owner)=>JSON.parse(fs.readFileSync(path.join(root,owner.directory,'package.json'),'utf8')) as {dependencies?:Record<string,string>;peerDependencies?:Record<string,string>;exports?:Record<string,string|{default?:string;types?:string}>};
    const destination=path.resolve(root,file),consumer=ownerOf(destination),consumerManifest=manifest(consumer),required=new Map<string,RequiredPackageExport>();
    const bind=(specifier:string):string=>{
        if(!specifier.startsWith('.')){
            const producer=registry.packages.find(owner=>specifier===owner.name||specifier.startsWith(owner.name+'/'));
            if(producer&&producer.name!==consumer.name&&!consumerManifest.dependencies?.[producer.name]&&!consumerManifest.peerDependencies?.[producer.name])throw new Error('Undeclared package dependency: '+consumer.name+' -> '+producer.name);
            return specifier;
        }
        const target=path.resolve(path.dirname(destination),specifier.replace(/\.js$/,'.ts')),producer=ownerOf(target);
        if(producer.name===consumer.name)return specifier;
        if(!consumerManifest.dependencies?.[producer.name]&&!consumerManifest.peerDependencies?.[producer.name])throw new Error('Undeclared package dependency: '+consumer.name+' -> '+producer.name);
        const relative=path.relative(sourceRoot(producer),target).replaceAll('\\','/');
        if(!relative.endsWith('.ts')||relative.endsWith('.d.ts'))throw new Error('Expected a TypeScript producer source: '+target);
        const exports=manifest(producer).exports??{},output='./dist/'+relative.replace(/\.ts$/,'.js');
        const existing=Object.entries(exports).find(([,entry])=>(typeof entry==='string'?entry:entry.default)===output);
        const key=existing?.[0]??'./internal/'+relative.replace(/\.ts$/,'');
        if(!existing){
            if(exports[key])throw new Error('Conflicting package export: '+producer.name+key.slice(1));
            const entry={types:'./dist/'+relative.replace(/\.ts$/,'.d.ts'),default:output};
            required.set(producer.name+key,{package:producer.name,manifest:path.relative(root,path.join(root,producer.directory,'package.json')).replaceAll('\\','/'),key,source:path.relative(root,target).replaceAll('\\','/'),entry});
        }
        return producer.name+(key==='.'?'':key.slice(1));
    };
    return {bind,required};
}

/** Source hosts use the same boundary policy; only module specifiers change. */
export function bindPackageSource(root:string,file:string,source:string):{source:string;exports:RequiredPackageExport[]} {
    const {bind,required}=packageBinder(root,file),parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),edits:{start:number;end:number;text:string}[]=[];
    for(const statement of parsed.statements){
        if((!ts.isImportDeclaration(statement)&&!ts.isExportDeclaration(statement))||!statement.moduleSpecifier||!ts.isStringLiteral(statement.moduleSpecifier))continue;
        const specifier=statement.moduleSpecifier,next=bind(specifier.text);if(next!==specifier.text)edits.push({start:specifier.getStart(parsed),end:specifier.end,text:JSON.stringify(next)});
    }
    for(const edit of edits.reverse())source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
    return {source,exports:[...required.values()]};
}
