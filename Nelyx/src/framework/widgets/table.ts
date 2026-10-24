// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../../foundation/errors.ts';
import {LocalKey,ValueKey,KeyMap} from '../../foundation/key.ts';
import {Widget,Element,RenderObjectWidget,RenderObjectElement,ParentDataWidget,IndexedSlot} from './framework.ts';
import type {WidgetOptions,BuildContext} from './framework.ts';
import {Directionality} from './app-data.ts';
import {RenderBox} from '../rendering/object.ts';
import type {RenderObject} from '../rendering/object.ts';
import {RenderTable,TableCellParentData,FlexColumnWidth,TableColumnWidth} from '../rendering/table.ts';
import type {RenderTableOptions,TableCellVerticalAlignment} from '../rendering/table.ts';
export interface TableRowOptions {readonly key?:LocalKey|null}
export class TableRow {
  readonly children:readonly Widget[];readonly key:LocalKey|null;
  constructor(children:readonly Widget[]=[],options:TableRowOptions={}){this.children=Object.freeze([...children]);this.key=options.key??null;invariant(this.key===null||this.key instanceof LocalKey,'invalid-table-row-key','TableRow requires a LocalKey');}
  toString():string{return `TableRow(${this.key?String(this.key)+', ':''}${this.children.length?'['+this.children.map(child=>child.constructor.name).join(', ')+']':'no children'})`;}
}
export interface TableOptions extends Omit<RenderTableOptions,'children'|'columns'|'rows'>,WidgetOptions {}
const anonymousRows=Symbol('Table unkeyed row');
class RowWidget extends Widget {
  constructor(readonly row:TableRow,ordinal:number){super(row.key??new ValueKey(ordinal,anonymousRows));}
  createElement():Element{return new RowElement(this);}
}
class RowElement extends Element {
  protected build():readonly Widget[]{return (this.widget as RowWidget).row.children;}
  protected override slotForChild(index:number,previous:Element|undefined):unknown{return new IndexedSlot(index,previous);}
}
class TableElement extends RenderObjectElement {
  protected override synchronizeRenderObjectChildren():void{const table=this.widget as Table,render=this.renderObject;invariant(render instanceof RenderTable,'invalid-table-render','Table requires RenderTable');const cells:RenderBox<RenderObject>[]=[],columns=table.children[0]?.children.length??0;for(const row of this.children){invariant(row.children.length===columns,'irregular-table-rows','Table row element has the wrong cell count');for(const cell of row.children){const objects=cell.renderObjects;invariant(objects.length===1&&objects[0] instanceof RenderBox,'invalid-table-cell','Each table cell must produce exactly one render box');cells.push(objects[0]);}}render.setFlatChildren(columns,cells);}
}
export class Table extends RenderObjectWidget {
  readonly children:readonly TableRow[];readonly columnWidths:ReadonlyMap<number,TableColumnWidth>;readonly defaultColumnWidth:TableColumnWidth;readonly textDirection:'ltr'|'rtl'|null;readonly defaultVerticalAlignment:TableCellVerticalAlignment;readonly textBaseline:RenderTableOptions['textBaseline'];private readonly rows:readonly Widget[];
  constructor(children:readonly TableRow[]=[],options:TableOptions={}){super(options.key??null);this.children=Object.freeze([...children]);this.columnWidths=new Map(options.columnWidths??[]);this.defaultColumnWidth=options.defaultColumnWidth??new FlexColumnWidth();this.textDirection=options.textDirection??null;this.defaultVerticalAlignment=options.defaultVerticalAlignment??'top';this.textBaseline=options.textBaseline??null;
    invariant(this.defaultVerticalAlignment!=='baseline'||this.textBaseline,'missing-table-baseline','An explicit textBaseline is required for baseline alignment');const rowKeys=new KeyMap<boolean>(),cellKeys=new KeyMap<boolean>(),columns=children[0]?.children.length??0;for(const row of children){invariant(row instanceof TableRow&&row.children.length===columns&&columns>0,'irregular-table-rows','Every non-empty table must have complete rows with at least one cell');if(row.key){invariant(!rowKeys.has(row.key),'duplicate-table-row-key','Table row keys must be unique');rowKeys.set(row.key,true);}for(const cell of row.children)if(cell.key){invariant(!cellKeys.has(cell.key),'duplicate-table-cell-key','All table cell widget keys must be unique across rows');cellKeys.set(cell.key,true);}}
    let ordinal=0;this.rows=Object.freeze(children.map(row=>new RowWidget(row,row.key?0:ordinal++)));}
  override get childWidgets():readonly Widget[]{return this.rows;}
  override createElement():Element{return new TableElement(this);}
  private options(context:BuildContext):RenderTableOptions{const textDirection=this.textDirection??context.maybeDependOn(Directionality)?.direction;invariant(textDirection,'missing-directionality','Table requires textDirection or an ambient Directionality');return {columnWidths:this.columnWidths,defaultColumnWidth:this.defaultColumnWidth,textDirection,defaultVerticalAlignment:this.defaultVerticalAlignment,textBaseline:this.textBaseline??null};}
  createRenderObject(context:BuildContext):RenderTable{return new RenderTable(this.options(context));}
  updateRenderObject(context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderTable,'invalid-table-render','Table requires RenderTable');const options=this.options(context);render.columnWidths=options.columnWidths??null;render.defaultColumnWidth=options.defaultColumnWidth!;render.textDirection=options.textDirection!;render.defaultVerticalAlignment=options.defaultVerticalAlignment!;render.textBaseline=options.textBaseline??null;}
}
export class TableCell extends ParentDataWidget<TableCellParentData> {
  readonly parentDataType=TableCellParentData;readonly verticalAlignment:TableCellVerticalAlignment|null;
  constructor(child:Widget,options:WidgetOptions&{readonly verticalAlignment?:TableCellVerticalAlignment|null}={}){super(child,options);this.verticalAlignment=options.verticalAlignment??null;invariant(this.verticalAlignment===null||['top','middle','bottom','baseline','fill','intrinsicHeight'].includes(this.verticalAlignment),'invalid-table-alignment','Unknown table cell alignment');}
  get debugTypicalAncestorWidgetClass():Function{return Table;}
  applyParentData(render:RenderObject):void{const data=render.parentData;invariant(data instanceof TableCellParentData,'invalid-parent-data','TableCell requires TableCellParentData');if(data.verticalAlignment!==this.verticalAlignment){data.verticalAlignment=this.verticalAlignment;render.parent?.markNeedsLayout();}}
}
