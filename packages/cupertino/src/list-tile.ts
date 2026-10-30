// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Managed resolved public API projection; behavior uses canonical Core owners.
import {Widget,StatefulWidget,StatelessWidget,State,Element} from '@nelyx/core/framework/widgets/framework';import type {WidgetOptions,BuildContext} from '@nelyx/core/framework/widgets/framework';import {Text} from '@nelyx/core/framework/widgets/basic';import {Color} from '@nelyx/core/ui/color';import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';import '@nelyx/core/framework/painting/box-decoration';import {invariant,exceptionStack} from '@nelyx/core/foundation/errors';import {FlutterError} from '@nelyx/core/foundation/flutter-error';import {FlutterErrorDetails} from '@nelyx/core/foundation/assertions';import {ErrorDescription} from '@nelyx/core/foundation/diagnostics';
import {buildCupertinoListTile,buildCupertinoListTileChevron} from "./internal/list/list-build.ts";
export interface CupertinoListTileOptions extends WidgetOptions {readonly id?:string;
  readonly title:Widget;
  readonly subtitle?:Widget|null;
  readonly additionalInfo?:Widget|null;
  readonly leading?:Widget|null;
  readonly trailing?:Widget|null;
  readonly onTap?:(()=>void|Promise<void>)|null;
  readonly backgroundColor?:Color|null;
  readonly backgroundColorActivated?:Color|null;
  readonly padding?:EdgeInsetsGeometry|null;
  /** @dartType double */ readonly leadingSize?:number;
  /** @dartType double */ readonly leadingToTitle?:number;
}
export class CupertinoListTile extends StatefulWidget {
  readonly id:string|undefined;private notchedVariant=false;
  readonly title:Widget;
  readonly subtitle:Widget|null;
  readonly additionalInfo:Widget|null;
  readonly leading:Widget|null;
  readonly trailing:Widget|null;
  readonly onTap:(()=>void|Promise<void>)|null;
  readonly backgroundColor:Color|null;
  readonly backgroundColorActivated:Color|null;
  readonly padding:EdgeInsetsGeometry|null;
  /** @dartType double */ readonly leadingSize:number;
  /** @dartType double */ readonly leadingToTitle:number;
  /**
 * @dartParam leadingSize double
 * @dartParam leadingToTitle double
   */
  constructor(o:CupertinoListTileOptions);
  constructor(id:string,title:string,onPressed:()=>void);
  constructor(first:CupertinoListTileOptions|string,title?:string,onPressed?:()=>void){const o:CupertinoListTileOptions=typeof first==='string'?{id:first,title:new Text(title??''),onTap:onPressed??null}:first;super(o.key??null);this.id=o.id;
    this.title=o.title;
    this.subtitle=o.subtitle??null;
    this.additionalInfo=o.additionalInfo??null;
    this.leading=o.leading??null;
    this.trailing=o.trailing??null;
    this.onTap=o.onTap??null;
    this.backgroundColor=o.backgroundColor??null;
    this.backgroundColorActivated=o.backgroundColorActivated??null;
    this.padding=o.padding??null;
    this.leadingSize=o.leadingSize??28;
    this.leadingToTitle=o.leadingToTitle??16;
    invariant(this.title instanceof Widget,"invalid-cupertino-list-title","CupertinoListTile requires a title Widget");
  }
  /**
 * @dartParam leadingSize double
 * @dartParam leadingToTitle double
   */
  static notched(o:CupertinoListTileOptions):CupertinoListTile{const tile=new CupertinoListTile({...o,leadingSize:o.leadingSize??30,leadingToTitle:o.leadingToTitle??12});tile.notchedVariant=true;return tile;}
  createState():State<CupertinoListTile>{return new class CupertinoListTileState extends State<CupertinoListTile> {
    private tapped=false;
    build(context:BuildContext):Widget{
      const report=(exception:unknown):void=>{const details=new FlutterErrorDetails({exception,stack:exceptionStack(exception),library:'Cupertino library',context:new ErrorDescription('while handling a CupertinoListTile tap')});if(context instanceof Element)context.owner.reportError(details);else FlutterError.reportError(details);};
      return buildCupertinoListTile(this.widget,this.widget.notchedVariant,context,this.tapped,{down:()=>this.setState(()=>{this.tapped=true;}),cancel:()=>this.setState(()=>{this.tapped=false;}),tap:()=>{void (async()=>{await this.widget.onTap!();if(this.mounted)this.setState(()=>{this.tapped=false;});})().catch(report);}});
    }
  }();}
}
export class CupertinoListTileChevron extends StatelessWidget {constructor(o:WidgetOptions={}){super(o.key??null);}build(context:BuildContext):Widget{return buildCupertinoListTileChevron(context);}}
