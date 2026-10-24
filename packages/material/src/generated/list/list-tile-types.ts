// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Finite API projection from pinned resolved IR; behavior is an explicit functional port.
export class ListTileStyle {
  static readonly list=new ListTileStyle(0,"list");
  static readonly drawer=new ListTileStyle(1,"drawer");
  static readonly values:readonly ListTileStyle[]=Object.freeze([ListTileStyle.list,ListTileStyle.drawer]);
  /** @dartType int */ readonly index:number;readonly name:string;
  private constructor(index:number,name:string){this.index=index;this.name=name;Object.freeze(this);}
  toString():string{return "ListTileStyle."+this.name;}
}
export class ListTileControlAffinity {
  static readonly leading=new ListTileControlAffinity(0,"leading");
  static readonly trailing=new ListTileControlAffinity(1,"trailing");
  static readonly platform=new ListTileControlAffinity(2,"platform");
  static readonly values:readonly ListTileControlAffinity[]=Object.freeze([ListTileControlAffinity.leading,ListTileControlAffinity.trailing,ListTileControlAffinity.platform]);
  /** @dartType int */ readonly index:number;readonly name:string;
  private constructor(index:number,name:string){this.index=index;this.name=name;Object.freeze(this);}
  toString():string{return "ListTileControlAffinity."+this.name;}
}
export class ListTileTitleAlignment {
  static readonly threeLine=new ListTileTitleAlignment(0,"threeLine");
  static readonly titleHeight=new ListTileTitleAlignment(1,"titleHeight");
  static readonly top=new ListTileTitleAlignment(2,"top");
  static readonly center=new ListTileTitleAlignment(3,"center");
  static readonly bottom=new ListTileTitleAlignment(4,"bottom");
  static readonly values:readonly ListTileTitleAlignment[]=Object.freeze([ListTileTitleAlignment.threeLine,ListTileTitleAlignment.titleHeight,ListTileTitleAlignment.top,ListTileTitleAlignment.center,ListTileTitleAlignment.bottom]);
  /** @dartType int */ readonly index:number;readonly name:string;
  private constructor(index:number,name:string){this.index=index;this.name=name;Object.freeze(this);}
  toString():string{return "ListTileTitleAlignment."+this.name;}
}
