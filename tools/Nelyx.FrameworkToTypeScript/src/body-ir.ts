// SPDX-License-Identifier: BSD-3-Clause
export interface Reference {id:string;name:string;owner:string|null;local:boolean;static:boolean;constant?:boolean;declarationOffset?:number|null}
interface Span {offset:number;length:number;origin?:{library:string;source:string;sourceSha256:string;offset:number;length:number;spanSha256:string}}
/** Analyzer-authored provenance; never inferred from names, literals or TS number. */
export interface NumericSource {type:string;inferred:boolean;bounds:{name:string;type:string}[];resolvedType?:ResolvedType}
type ExpressionData=
  |{kind:'literal';value:number|string|boolean|null;negativeZero?:true}
  |{kind:'this'|'super'}
  |{kind:'cascadeTarget'}
  |{kind:'nullChainTarget'}
  |{kind:'nullChain';target:Expression;body:Expression}
  |{kind:'await';value:Expression}
  |{kind:'throw';value:Expression}
  |{kind:'rethrow'}
  |{kind:'typeLiteral';valueType:ResolvedType}
  |{kind:'collectionList';elementType:ResolvedType;elements:CollectionElement[]}
  |{kind:'collectionLiteral';collectionKind:'map'|'set';collectionType:ResolvedType;constant?:boolean;elements:CollectionElement[]}
  |{kind:'recordLiteral';fields:Expression[]}
  |{kind:'recordAccess';target:Expression;index:number;arity:number;nullAware:boolean}
  |{kind:'namedRecordLiteral';fields:{key:string|number;value:Expression}[];shape:ResolvedType&{kind:'namedRecord'}}
  |{kind:'namedRecordAccess';target:Expression;key:string|number;arity:number;names:string[];nullAware:boolean}
  |{kind:'recordAssignment';value:Expression;pattern:RecordAssignmentPattern}
  |{kind:'cascade';target:Expression;nullAware:boolean;sections:Expression[]}
  |{kind:'closure';typeParameters?:ClassTypeParameter[];parameters:ClassFormal[];returnType:ResolvedType;body:Statement}
  |{kind:'invoke';target:Expression;signature:ResolvedType;nullAware?:boolean;args:Argument[];typeArguments?:ResolvedType[];resolvedTypeArguments?:ResolvedType[]|null}
  |{kind:'typeTest';value:Expression;checkedType:ResolvedType;negated:boolean}
  |{kind:'typeCast';value:Expression;checkedType:ResolvedType}
  |{kind:'interpolation';parts:({kind:'text';value:string}|{kind:'expression';value:Expression;resolvedType?:ResolvedType})[]}
  |{kind:'identifier';name:string;reference:Reference|null}
  |{kind:'property';target:Expression;name:string;reference:Reference|null;targetType:string;nullAware?:boolean}
  |{kind:'index';target:Expression;index:Expression;targetType:string;reference?:Reference|null;nullAware?:boolean}
  |{kind:'binary'|'assignment';operator:string;reference?:Reference|null;left:Expression;right:Expression;indexedRead?:{reference:Reference|null;type:ResolvedType}}
  |{kind:'prefix'|'postfix'|'parenthesized';operator?:string;reference?:Reference|null;value:Expression}
  |{kind:'conditional';test:Expression;then:Expression;else:Expression}
  |{kind:'switchExpression';value:Expression;cases:{test:Expression|null;result:Expression}[]}
  |{kind:'patternSwitchExpression';value:Expression;resultType:ResolvedType;cases:{pattern:MatchPattern;guard:Expression|null;result:Expression}[]}
  |{kind:'recordSwitchExpression';value:Expression;matchedType:ResolvedType;cases:{tests:{path:number[];test:Expression}[];result:Expression}[]}
  |{kind:'call';target:Expression|null;nullAware?:boolean;name:string;reference:Reference|null;args:Argument[];typeArguments?:ResolvedType[];resolvedTypeArguments?:ResolvedType[]|null}
  |{kind:'construct';name:string;constructor:string|null;reference:Reference|null;args:Argument[];const:boolean;constructedType?:ResolvedType}
  |{kind:'list';values:Expression[];elementType?:ResolvedType;constant?:boolean};
export type Expression=ExpressionData&Span&{type:string;numeric?:NumericSource|null;storageType?:ResolvedType;operatorParameterType?:ResolvedType;appliedOperatorParameterType?:ResolvedType;indexParameterType?:ResolvedType;appliedIndexParameterType?:ResolvedType;functionType?:ResolvedType;recordType?:ResolvedType;promotedType?:ResolvedType};
export interface Argument {name:string|null;value:Expression;parameterType?:ResolvedType;appliedParameterType?:ResolvedType}
export interface Variable {name:string;reference?:Reference|null;type:string;value:Expression|null;numeric?:NumericSource|null;resolvedType?:ResolvedType}
/** Irrefutable record assignment: prepare every match/cast, then commit locals in source order. */
export type RecordAssignmentPattern=
  |{kind:'record';arity:number;names:string[];fields:{key:number|string;pattern:RecordAssignmentPattern}[]}
  |{kind:'target';target:Expression;matchedType:ResolvedType;requiresCast:boolean}
  |{kind:'wildcard';checkedType:ResolvedType|null}
  |{kind:'cast';checkedType:ResolvedType;pattern:RecordAssignmentPattern}
  |{kind:'nullAssert';pattern:RecordAssignmentPattern};
/** Analyzer label identity is local control flow, never a source dependency. */
export interface SourceLabel {id:string;name:string}
/** Analyzer-resolved refutable patterns; every field keeps its getter identity and storage provenance. */
export type MatchPattern=
  |{kind:'record';arity:number;names:string[];fields:{key:number|string;pattern:MatchPattern}[]}
  |{kind:'relational';operator:string;reference:Reference;matchedType:ResolvedType;matchedTypeName:string;operand:Expression;cacheKey:string;parameterType:ResolvedType;appliedParameterType:ResolvedType;returnType:ResolvedType}
  |{kind:'logicalAnd';left:MatchPattern;right:MatchPattern}
  |{kind:'map';type:ResolvedType;explicitTypes:boolean;entries:{key:Expression;cacheKey:string;pattern:MatchPattern}[]}
  |{kind:'object';type:ResolvedType;fields:{name:string;reference:Reference;type:string;numeric:NumericSource|null;resolvedType:ResolvedType;storageType:ResolvedType;pattern:MatchPattern}[]}
  |{kind:'variable';final:boolean;checkedType:ResolvedType|null;variable:Variable}
  |{kind:'constant';value:Expression}
  |{kind:'objectConstant';value:Expression;constantType:ResolvedType}
  |{kind:'nullCheck';pattern:MatchPattern}
  |{kind:'logicalOr';left:MatchPattern;right:MatchPattern}
  |{kind:'wildcard';checkedType:ResolvedType|null};
export type CollectionElement={kind:'value';value:Expression}|{kind:'nullAwareValue';value:Expression}|{kind:'entry';key:Expression;value:Expression}|{kind:'nullAwareEntry';key:Expression;value:Expression;keyNullAware:boolean;valueNullAware:boolean}|{kind:'spread';value:Expression;nullAware:boolean}|{kind:'if';test:Expression;then:CollectionElement;else:CollectionElement|null}|{kind:'ifCase';value:Expression;pattern:MatchPattern;guard:Expression|null;then:CollectionElement;else:CollectionElement|null}|{kind:'forEach';variable:Variable;final:boolean;iterable:Expression;body:CollectionElement}|{kind:'for';variables:Statement&{kind:'variables'};test:Expression|null;updates:Expression[];body:CollectionElement};
export type Statement=Span&{async?:boolean}&(
  |{kind:'empty'}
  |{kind:'block';statements:Statement[]}
  |{kind:'return';value:Expression|null}
  |{kind:'expression';value:Expression}
  |{kind:'variables';final:boolean;late?:boolean;variables:Variable[]}
  |{kind:'recordVariables';final:boolean;value:Expression;recordType:ResolvedType;bindings:({path:(number|string)[];variable:Variable;checkedType?:ResolvedType}|{path:(number|string)[];discard:true;checkedType:ResolvedType})[]}
  |{kind:'if';test:Expression;then:Statement;else:Statement|null}
  |{kind:'ifCase';value:Expression;pattern:MatchPattern;guard:Expression|null;then:Statement;else:Statement|null}
  |{kind:'while'|'do';test:Expression;body:Statement}
  |{kind:'labeled';labels:SourceLabel[];body:Statement}
  |{kind:'forEach';variable:Variable;final:boolean;iterable:Expression;body:Statement}
  |{kind:'break'|'continue';label?:SourceLabel}
  |{kind:'try';body:Statement;catches:{type:ResolvedType|null;exception:string|null;stack:string|null;body:Statement}[];finally:Statement|null}
  |{kind:'switch';value:Expression;exhaustive?:boolean;cases:{test:Expression|null;statements:Statement[]}[]}
  |{kind:'caseSwitch';value:Expression;exhaustive:boolean;cases:{tests:(Expression|null)[];labels:SourceLabel[];statements:Statement[]}[]}
  |{kind:'patternSwitch';value:Expression;cases:{pattern:MatchPattern|null;guard:Expression|null;statements:Statement[]}[]}
  |{kind:'recordSwitch';value:Expression;recordType:ResolvedType;cases:{tests:{path:number[];test:Expression}[]|null;statements:Statement[]}[]}
  |{kind:'assert';test:Expression;message:Expression|null}
  |{kind:'for';variables:Statement&{kind:'variables'};test:Expression|null;updates:Expression[];body:Statement});
export interface Parameter {name:string;type:string;named:boolean;required:boolean;default:Expression|null;numeric?:NumericSource|null;resolvedType?:ResolvedType;covariant?:boolean}
/** Resolved generic/type identities for whole class lowering; no display-string type parsing. */
export type ResolvedType={nullable:boolean;alias?:{reference:Reference;arguments:ResolvedType[]}}&(
  |{kind:'interface';reference:Reference;arguments:ResolvedType[]}
  |{kind:'parameter';reference:Reference;promotedBound?:ResolvedType}
  |{kind:'function';typeParameters?:ClassTypeParameter[];returnType:ResolvedType;parameters:FunctionParameter[]}
  |{kind:'record';fields:ResolvedType[]}
  |{kind:'namedRecord';positional:ResolvedType[];named:{name:string;type:ResolvedType}[]}
  |{kind:'void'}|{kind:'never'}|{kind:'dynamic'});
export interface FunctionParameter {name:string;named:boolean;required:boolean;type:ResolvedType}
export interface ClassTypeParameter {name:string;reference:Reference;bound:ResolvedType|null}
export interface ClassField {name:string;reference:Reference;type:ResolvedType;final:boolean;late?:boolean;static?:boolean;lazyStatic?:boolean;accessorOverrides?:Reference[];initializer?:Expression|null;offset:number;length:number;numeric?:NumericSource|null}
export interface FieldFormal extends Parameter {field:Reference;resolvedType:ResolvedType}
export interface ClassFormal extends Parameter {field:Reference|null;resolvedType:ResolvedType;reference?:Reference}
export type ClassInitializer={kind:'field';field:Reference;value:Expression}|(Statement&{kind:'assert'});
export interface ClassMethod extends Span {name:string;reference:Reference;operator?:boolean;static:boolean;getter:boolean;setter?:boolean;abstract?:boolean;overrides?:boolean;overrideOrigins?:Reference[];typeParameters?:ClassTypeParameter[];returnType:ResolvedType;parameters:ClassFormal[];body:Statement|null;numericReturn?:NumericSource|null}
export interface ConstructorPrelude {variables:Variable[];checks:ClassFormal[]}
export interface GenerativeRedirect {reference:Reference;args:Argument[]}
/** Compiler-owned application/nominal nodes; original instance bodies stay in the application. */
export interface SourceMixinApplication {owner:Reference;type:ResolvedType}
export interface NamedConstructor extends Span {name:string;reference:Reference;factory:boolean;physicalAnchor?:true;superclass?:{type:ResolvedType;constructor:Reference;implicit:boolean;args?:Argument[]}|null;parameters:ClassFormal[];initializers:({kind:'field';field:Reference;value:Expression}|(Statement&{kind:'assert'}))[];body:Statement|null;const:boolean;redirect?:{reference:Reference;type:ResolvedType;name:string|null;args:Argument[]};generativeRedirect?:GenerativeRedirect;prelude?:ConstructorPrelude[];redirected?:true}
export interface SourceFactories {unnamed:NamedConstructor|null;generativeAnchor:boolean;nominalSuperclass:ResolvedType|null}
export type Declaration=Span&{numeric?:NumericSource|null;numericReturn?:NumericSource|null}&(
  |{kind:'typeAlias';name:string;reference:Reference;typeParameters:ClassTypeParameter[];aliasedType:ResolvedType;numericMembers:{path:(string|number)[];numeric:NumericSource}[]}
  |{kind:'enum';name:string;reference:Reference;indexType:ResolvedType;numericIndex:NumericSource;mixins?:ResolvedType[];methods?:ClassMethod[];fields?:ClassField[];values:(Span&{name:string;reference:Reference;index:number})[]}
  |{kind:'mixinInterface';name:string;reference:Reference;typeParameters:ClassTypeParameter[];methods:ClassMethod[]}
  |{kind:'mixin';name:string;reference:Reference;typeParameters?:ClassTypeParameter[];onConstraints?:ResolvedType[];interfaces?:ResolvedType[];fields?:ClassField[];methods:ClassMethod[]}
  |{kind:'function'|'method';name:string;owner?:string;reference:Reference|null;typeParameters?:ClassTypeParameter[];returnType:string;resolvedReturnType?:ResolvedType;parameters:Parameter[];body:Statement}
  |{kind:'topGetter';name:string;reference:Reference;returnType:string;resolvedReturnType:ResolvedType;body:Statement}
  |{kind:'constant';name:string;owner:string|null;reference:Reference|null;type:string;resolvedType?:ResolvedType;value:Expression}
  |{kind:'class';name:string;reference:Reference;mixinClass?:boolean;sourceFactories?:SourceFactories;sourceMixinOwner?:true;sourceMixinApplication?:SourceMixinApplication;abstract?:boolean;namedOnly?:boolean;interfaces?:ResolvedType[];mixins?:ResolvedType[];superclass?:{type:ResolvedType;constructor:Reference;implicit:boolean;args?:Argument[]}|null;typeParameters:ClassTypeParameter[];fields:ClassField[];constructor:{parameters:ClassFormal[];assertions:(Statement&{kind:'assert'})[];initializers?:ClassInitializer[];reference?:Reference;body?:Statement|null;const:boolean;offset:number;length:number;generativeRedirect?:GenerativeRedirect;prelude?:ConstructorPrelude[];redirected?:true};methods?:ClassMethod[];namedConstructors?:NamedConstructor[]});
export interface BodyRecord {source:string;symbol:string;sourceSha256:string;spanSha256?:string;packagePin?:PackagePin;library?:string;ir?:Declaration;diagnostic?:string}
export interface BodyIr {schema:'nelyx.resolved-body-ir/v1';records:BodyRecord[]}
export interface PackagePin {name:string;version:string;archiveSha256:string}
export interface ModuleRecipe {
  source:string;sha256:string;symbols:string[];destination:string;
  /** Exact hosted package source URI and owning library, checked against the tool lock. */
  packagePin?:PackagePin;library?:string;librarySha256?:string;
  classNames?:Record<string,string>;renames?:Record<string,string>;
  imports?:Record<string,string>;typeImports?:Record<string,string>;durationUnit?:'milliseconds';
  /** Opt-in for shared binding catalogs. Initialization dependencies remain explicit. */
  importEmission?:{policy:'used-identifiers';sideEffects?:string[]};
  /** Analyzer-proven local promotions and exact enum/bool switch coverage. */
  sourceFlow?:{policy:'resolved-source-flow'};
  /** Exact owned arithmetic methods have distinct stable unary/binary slots. */
  sourceOperators?:{policy:'resolved-source-arithmetic'};
  /** Source getter bodies remain live readonly accessors, with a capture-free namespace. */
  topLevelGetters?:{policy:'live-source-accessors';namespace:string};
  implicitTypeParameterBound?:'dart-object-nullable';
  /** Generic function values prepend checked type witnesses, using the common
   * methodTypeWitnesses imports. Other recipes must reject this callable ABI. */
  genericFunctionValues?:{policy:'checked-generic-function-type-witness'};
  /** Private backing storage implements exact owned inherited accessors.
   * Concrete accessors require the broader policy; genuine source storage
   * overrides and partial getter/setter forwarding remain separate. */
  fieldImplementations?:{policy:'abstract-accessor-source-field'|'inherited-accessor-source-field'};
  /** Full original instance bodies apply to an exact owned superclass chain. */
  sourceMixinApplications?:{policy:'owned-source-mixin-application';hasCaptured:string};
  /** Ordered source patterns cache getters by static access path across arms/guards.
   * Scalar constant equality uses the existing receiver-directed value boundary. */
  patternMatching?:{policy:'ordered-cached-access-paths';equals:string};
  /** Core DartMap nominal admission and virtual get/containsKey, never JS object shape. */
  mapPatterns?:{policy:'dart-map-get-then-presence';type:string};
  /** Resolved operator identity and tagged num comparison; results cache by
   * static receiver path, selector and analyzer canonical constant identity. */
  relationalPatterns?:{policy:'resolved-cached-relations';unwrapNum:string};
  recordAssignments?:{policy:'checked-record-assignment'};
  /** Only the pure Core shape probe is caught; getters, casts and guards propagate failures. */
  recordPatterns?:{policy:'core-shape-probe'};
  /** Source object constants compare as receivers and cache by canonical runtime
   * identity within each static access path. Uses reviewed const/value boundaries. */
  objectConstantPatterns?:{policy:'canonical-receiver-equality'};
  recordDiscards?:{policy:'checked-typed-wildcards'};
  /** Explicit source dynamic value storage; unchecked dynamic dispatch remains blocked. */
  dynamicValues?:{policy:'checked-erased-values'};
  adapters?:Record<string,{target:string;kind:'call'|'new'|'identity';receiver?:'first'|'target'|'owner';namedArguments?:'options'|'trailing-options';typeArguments?:string[];numericAbi?:'scalar-numeric'}>;
  /** Reified external constructor instances require an exact reviewed specialization. */
  constructorSpecializations?:Record<string,{typeArguments:string[];target:string;kind:'call'|'new';namedArguments?:'options'|'trailing-options'}[]>;
  /** Exact external constructor application, including source parameter identities.
   * Selected parameters become host generic arguments; optional witnesses precede
   * ordinary arguments. Explicit witness paths may select concrete source arguments
   * independently of host type projection. This does not admit const or erased generics. */
  constructorApplications?:Record<string,{type:ResolvedType;typeParameters:string[];typeArgumentPaths?:number[][];witnessArgumentPaths?:number[][];target:string;kind:'call'|'new';namedArguments?:'options'|'trailing-options';passWitnesses?:boolean;policy:'checked-generic-constructor-application'}[]>;
  /** Exact immutable generated constructor -> imported canonical factory, receiving its class first. */
  constantConstructors?:Record<string,{factory:string;policy:'canonical-immutable-generated'|'canonical-immutable-generated-named'|'canonical-immutable-generic-fields'|'canonical-immutable-constructor-fields'|'canonical-generated-redirect';hostBase?:{target:string;policy:'stateless-const-base'};exportFactory?:string}|{factory:string;policy:'canonical-generated-external';ownerType:string}|{factory:string;policy:'canonical-generated-external-fields'|'canonical-immutable-host'|'canonical-immutable-host-fields';ownerType:string;namedArguments?:'options'|'trailing-options'}>;
  /** Explicit host Future boundary; does not assert Dart Zone or arbitrary Future equivalence. */
  asyncRuntime?:{policy:'host-promise';futureType:string};
  /** Runtime adapters must preserve the selected source iteration/mutation contract. */
  iteration?:{policy:'host-iterable'};
  /** Shared receiver + resolved method cache; preserves add/remove listener equality. */
  methodTearOff?:{bind:string;policy:'receiver-method-identity'};
  /** Exact host constructor binding. Host must not read derived fields or call overrides during construction. */
  superConstructors?:Record<string,{target:string;policy:'no-derived-state-observation';namedArguments?:'options';mixins?:string[];baseType?:string;
    /** Exact producer constructor ABI: prepend witnesses for resolved source arguments. */
    typeWitnessArguments?:{policy:'resolved-super-type-arguments';arity:number}}>;
  /** Exact qualified constants, with no evaluation of source display text. */
  values?:Record<string,number|string|boolean|null>;
  /** Exact resolved collection type -> checked ordered Map/Set factory (set/add protocol). */
  collectionLiterals?:{type:ResolvedType;factory:string;constantFactory?:string;constantPolicy?:'canonical-map-entries'|'canonical-set-values';typeParameters?:string[];
    /** Non-const factory arguments selected from exact resolved Map/Set applications.
     * Paths are independent of the host TypeScript type parameter selection. */
    witnessArgumentPaths?:number[][];policy:'ordered-dart-collection'}[];
  /** Exact resolved element applications opt into witnessed mutable List storage.
   * The factory takes a witness and ordered element producers, not eager values.
   * Const input must remain explicit and is not admitted by this mutable policy. */
  listLiterals?:{elementType:ResolvedType;factory:string;policy:'witnessed-mutable-list'}[];
  /** Exact nested parameter applications retain their original runtime checks. */
  parameterTypeWitnesses?:{type:ResolvedType;policy:'checked-parameter-application'}[];
  /** Exact mutable generic instance fields check the owning receiver's captured
   * argument application, including writes from a different lexical class. */
  fieldTypeWitnesses?:{fields:string[];policy:'checked-field-type-application'};
  /** Capture returns the original non-null value and host stack text. No VM frames claim. */
  exceptions?:{capture:string;policy:'host-exception-stack'};
  /** Uninitialized instance fields only; lazy initializer semantics remain separate. */
  lateFields?:{read:string;write:string;initialize?:string;policy:'checked-late-instance'};
  lateLocals?:{create:string;policy:'checked-late-local'};
  /** Positional, non-const records. Structural equality and named fields are separate. */
  records?:{type:string;create:string;read:string;equals?:string;policy:'immutable-positional-record'};
  /** Exact immutable named/mixed shape; equality, const and patterns stay separate. */
  namedRecords?:{type:string;create:string;read:string;policy:'immutable-named-record'};
  /** Non-late mutable/final static fields are lazy and shared by the declaring class. */
  staticFields?:{read:string;write:string;seal:string;policy:'lazy-class-fields'};
  /** Opt-in UI value representations; unrestricted Dart integers stay blocked. */
  numericTypes?:{int?:{representation:'safe-number';check:string};num?:{representation:'double'}};
  /** Scalars stay numbers; erased Object/num/T slots retain explicit numeric kind.
   * Uses resolved declaration/flow identities, never integrality or value spelling. */
  numericValues?:{policy:'source-numeric-erasure';int:string;double:string;castInt:string;castDouble:string;numType:string;genericTypes?:{int:string;double:string}};
  numericFunctions?:{policy:'source-function-representation';bridge:string;identity:string;unwrapNum:string};
    /** Exact core binary operations preserve source carrier kind before scalar use. */
    numericOperators?:{policy:'retained-core-numeric-operations';operators:Record<string,string>};
  /** Tracked TS declarations composed after generated declarations, in recipe order. */
  manualDeclarations?:string[];
  assertion?:{code:string;message:string};
  /** Qualified Dart type identity -> already explicitly imported TS type. */
  typeBindings?:Record<string,string>;
  /** Exact Dart implements interface -> imported public structural host contract. */
  interfaceBindings?:Record<string,string>;
  /** Exact runtime predicates and checked casts. Type-only assertions are never casts. */
  runtimeTypes?:Record<string,{is:string;cast:string}>;
  /** Reviewed nominal identity of owned class/enum tokens; excludes implements-only objects. */
  generatedRuntimeTypes?:string[];
  /** Exact imported generated static-method ABI: resolved type arguments become
   * hidden witnesses before source arguments. Source callback/storage metadata
   * still controls numeric transfer; explicit and inferred calls share the ABI. */
  externalStaticMethods?:Record<string,{ownerType:string;target:string;arity:number;namedArguments?:'options'|'trailing-options';policy:'reified-generated-static'}>;
  /** Reviewed runtime admission for an exact generic application; not VM reification. */
  runtimeTypeApplications?:{type:ResolvedType;is:string;typeParameters?:string[];policy:'checked-host-type-application'}[];
  /** Explicit hidden generic method arguments. All token factories must be pure/canonical.
   * Host witnesses preserve resolved Dart identity/nullability; they must not infer int/double
   * from a JS number. Class reification, virtual overrides and tear-offs remain separate. */
  methodTypeWitnesses?:{policy:'checked-method-type-witness';methods:string[];type:string;is:string;cast:string;nullable:string;
    types:Record<string,string>;applications:Record<string,{factory:string;arity:number}>};
  /** Shares the explicit witness representation above. Captures lexical class arguments
   * after super and projects exact source superclass/interfaces. Generic const and
   * recursive nominal type projections require separate rules. */
  classTypeWitnesses?:{policy:'captured-class-type-witness';classes:string[];apply:string;capture:string;read:string};
  /** Exact instance host properties, on inherited this or explicit receivers. */
  memberBindings?:Record<string,string>;
  /** Exact interface or in-scope type-parameter identity -> imported conversion. */
  stringConversions?:Record<string,string>;
}
