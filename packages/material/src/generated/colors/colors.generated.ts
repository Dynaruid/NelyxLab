// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Immutable data from Flutter 71e4717a61786faab4c7aa39825989305ed29e8a packages/flutter/lib/src/material/colors.dart; SHA256 2863b158929eabea9f827e48ce50766193fe52731bd193c94fb4f80977571e04.
// Regenerate with tools/Nelyx.FrameworkToTypeScript/generate-design-data.mjs.
import { Color } from '@nelyx/core/ui/color';
import { constSourceColor } from '@nelyx/core/internal/ui/color-source-adapter';
import { MaterialColor, MaterialAccentColor } from '../../material-color.ts';
export { MaterialColor, MaterialAccentColor } from '../../material-color.ts';
export abstract class Colors {
  static readonly transparent: Color = constSourceColor(Color, 0);
  static readonly black: Color = constSourceColor(Color, 4278190080);
  static readonly black87: Color = constSourceColor(Color, 3707764736);
  static readonly black54: Color = constSourceColor(Color, 2315255808);
  static readonly black45: Color = constSourceColor(Color, 1929379840);
  static readonly black38: Color = constSourceColor(Color, 1627389952);
  static readonly black26: Color = constSourceColor(Color, 1107296256);
  static readonly black12: Color = constSourceColor(Color, 520093696);
  static readonly white: Color = constSourceColor(Color, 4294967295);
  static readonly white70: Color = constSourceColor(Color, 3019898879);
  static readonly white60: Color = constSourceColor(Color, 2583691263);
  static readonly white54: Color = constSourceColor(Color, 2332033023);
  static readonly white38: Color = constSourceColor(Color, 1660944383);
  static readonly white30: Color = constSourceColor(Color, 1308622847);
  static readonly white24: Color = constSourceColor(Color, 1040187391);
  static readonly white12: Color = constSourceColor(Color, 536870911);
  static readonly white10: Color = constSourceColor(Color, 452984831);
  private static readonly _redPrimaryValue: number = 4294198070;
  static readonly red: MaterialColor = new MaterialColor(
    Colors._redPrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4294962158)],
      [100, constSourceColor(Color, 4294954450)],
      [200, constSourceColor(Color, 4293892762)],
      [300, constSourceColor(Color, 4293227379)],
      [400, constSourceColor(Color, 4293874512)],
      [500, constSourceColor(Color, Colors._redPrimaryValue)],
      [600, constSourceColor(Color, 4293212469)],
      [700, constSourceColor(Color, 4292030255)],
      [800, constSourceColor(Color, 4291176488)],
      [900, constSourceColor(Color, 4290190364)],
    ]),
  );
  private static readonly _redAccentValue: number = 4294922834;
  static readonly redAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._redAccentValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4294937216)],
      [200, constSourceColor(Color, Colors._redAccentValue)],
      [400, constSourceColor(Color, 4294907716)],
      [700, constSourceColor(Color, 4292149248)],
    ]),
  );
  private static readonly _pinkPrimaryValue: number = 4293467747;
  static readonly pink: MaterialColor = new MaterialColor(
    Colors._pinkPrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4294763756)],
      [100, constSourceColor(Color, 4294491088)],
      [200, constSourceColor(Color, 4294217649)],
      [300, constSourceColor(Color, 4293943954)],
      [400, constSourceColor(Color, 4293673082)],
      [500, constSourceColor(Color, Colors._pinkPrimaryValue)],
      [600, constSourceColor(Color, 4292352864)],
      [700, constSourceColor(Color, 4290910299)],
      [800, constSourceColor(Color, 4289533015)],
      [900, constSourceColor(Color, 4287106639)],
    ]),
  );
  private static readonly _pinkAccentPrimaryValue: number = 4294918273;
  static readonly pinkAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._pinkAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4294934699)],
      [200, constSourceColor(Color, Colors._pinkAccentPrimaryValue)],
      [400, constSourceColor(Color, 4294246487)],
      [700, constSourceColor(Color, 4291105122)],
    ]),
  );
  private static readonly _purplePrimaryValue: number = 4288423856;
  static readonly purple: MaterialColor = new MaterialColor(
    Colors._purplePrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4294174197)],
      [100, constSourceColor(Color, 4292984551)],
      [200, constSourceColor(Color, 4291728344)],
      [300, constSourceColor(Color, 4290406600)],
      [400, constSourceColor(Color, 4289415100)],
      [500, constSourceColor(Color, Colors._purplePrimaryValue)],
      [600, constSourceColor(Color, 4287505578)],
      [700, constSourceColor(Color, 4286259106)],
      [800, constSourceColor(Color, 4285143962)],
      [900, constSourceColor(Color, 4283045004)],
    ]),
  );
  private static readonly _purpleAccentPrimaryValue: number = 4292886779;
  static readonly purpleAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._purpleAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4293558524)],
      [200, constSourceColor(Color, Colors._purpleAccentPrimaryValue)],
      [400, constSourceColor(Color, 4292149497)],
      [700, constSourceColor(Color, 4289331455)],
    ]),
  );
  private static readonly _deepPurplePrimaryValue: number = 4284955319;
  static readonly deepPurple: MaterialColor = new MaterialColor(
    Colors._deepPurplePrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4293781494)],
      [100, constSourceColor(Color, 4291937513)],
      [200, constSourceColor(Color, 4289961435)],
      [300, constSourceColor(Color, 4287985101)],
      [400, constSourceColor(Color, 4286470082)],
      [500, constSourceColor(Color, Colors._deepPurplePrimaryValue)],
      [600, constSourceColor(Color, 4284364209)],
      [700, constSourceColor(Color, 4283510184)],
      [800, constSourceColor(Color, 4282722208)],
      [900, constSourceColor(Color, 4281408402)],
    ]),
  );
  private static readonly _deepPurpleAccentPrimaryValue: number = 4286336511;
  static readonly deepPurpleAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._deepPurpleAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4289956095)],
      [200, constSourceColor(Color, Colors._deepPurpleAccentPrimaryValue)],
      [400, constSourceColor(Color, 4284817407)],
      [700, constSourceColor(Color, 4284612842)],
    ]),
  );
  private static readonly _indigoPrimaryValue: number = 4282339765;
  static readonly indigo: MaterialColor = new MaterialColor(
    Colors._indigoPrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4293454582)],
      [100, constSourceColor(Color, 4291152617)],
      [200, constSourceColor(Color, 4288653530)],
      [300, constSourceColor(Color, 4286154443)],
      [400, constSourceColor(Color, 4284246976)],
      [500, constSourceColor(Color, Colors._indigoPrimaryValue)],
      [600, constSourceColor(Color, 4281944491)],
      [700, constSourceColor(Color, 4281352095)],
      [800, constSourceColor(Color, 4280825235)],
      [900, constSourceColor(Color, 4279903102)],
    ]),
  );
  private static readonly _indigoAccentPrimaryValue: number = 4283657726;
  static readonly indigoAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._indigoAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4287405823)],
      [200, constSourceColor(Color, Colors._indigoAccentPrimaryValue)],
      [400, constSourceColor(Color, 4282211070)],
      [700, constSourceColor(Color, 4281356286)],
    ]),
  );
  private static readonly _bluePrimaryValue: number = 4280391411;
  static readonly blue: MaterialColor = new MaterialColor(
    Colors._bluePrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4293128957)],
      [100, constSourceColor(Color, 4290502395)],
      [200, constSourceColor(Color, 4287679225)],
      [300, constSourceColor(Color, 4284790262)],
      [400, constSourceColor(Color, 4282557941)],
      [500, constSourceColor(Color, Colors._bluePrimaryValue)],
      [600, constSourceColor(Color, 4280191205)],
      [700, constSourceColor(Color, 4279858898)],
      [800, constSourceColor(Color, 4279592384)],
      [900, constSourceColor(Color, 4279060385)],
    ]),
  );
  private static readonly _blueAccentPrimaryValue: number = 4282682111;
  static readonly blueAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._blueAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4286755327)],
      [200, constSourceColor(Color, Colors._blueAccentPrimaryValue)],
      [400, constSourceColor(Color, 4280908287)],
      [700, constSourceColor(Color, 4280902399)],
    ]),
  );
  private static readonly _lightBluePrimaryValue: number = 4278430196;
  static readonly lightBlue: MaterialColor = new MaterialColor(
    Colors._lightBluePrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4292998654)],
      [100, constSourceColor(Color, 4289979900)],
      [200, constSourceColor(Color, 4286698746)],
      [300, constSourceColor(Color, 4283417591)],
      [400, constSourceColor(Color, 4280923894)],
      [500, constSourceColor(Color, Colors._lightBluePrimaryValue)],
      [600, constSourceColor(Color, 4278426597)],
      [700, constSourceColor(Color, 4278356177)],
      [800, constSourceColor(Color, 4278351805)],
      [900, constSourceColor(Color, 4278278043)],
    ]),
  );
  private static readonly _lightBlueAccentPrimaryValue: number = 4282434815;
  static readonly lightBlueAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._lightBlueAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4286634239)],
      [200, constSourceColor(Color, Colors._lightBlueAccentPrimaryValue)],
      [400, constSourceColor(Color, 4278235391)],
      [700, constSourceColor(Color, 4278227434)],
    ]),
  );
  private static readonly _cyanPrimaryValue: number = 4278238420;
  static readonly cyan: MaterialColor = new MaterialColor(
    Colors._cyanPrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4292933626)],
      [100, constSourceColor(Color, 4289915890)],
      [200, constSourceColor(Color, 4286635754)],
      [300, constSourceColor(Color, 4283289825)],
      [400, constSourceColor(Color, 4280731354)],
      [500, constSourceColor(Color, Colors._cyanPrimaryValue)],
      [600, constSourceColor(Color, 4278234305)],
      [700, constSourceColor(Color, 4278228903)],
      [800, constSourceColor(Color, 4278223759)],
      [900, constSourceColor(Color, 4278214756)],
    ]),
  );
  private static readonly _cyanAccentPrimaryValue: number = 4279828479;
  static readonly cyanAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._cyanAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4286906367)],
      [200, constSourceColor(Color, Colors._cyanAccentPrimaryValue)],
      [400, constSourceColor(Color, 4278248959)],
      [700, constSourceColor(Color, 4278237396)],
    ]),
  );
  private static readonly _tealPrimaryValue: number = 4278228616;
  static readonly teal: MaterialColor = new MaterialColor(
    Colors._tealPrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4292932337)],
      [100, constSourceColor(Color, 4289912795)],
      [200, constSourceColor(Color, 4286630852)],
      [300, constSourceColor(Color, 4283283116)],
      [400, constSourceColor(Color, 4280723098)],
      [500, constSourceColor(Color, Colors._tealPrimaryValue)],
      [600, constSourceColor(Color, 4278225275)],
      [700, constSourceColor(Color, 4278221163)],
      [800, constSourceColor(Color, 4278217052)],
      [900, constSourceColor(Color, 4278209856)],
    ]),
  );
  private static readonly _tealAccentPrimaryValue: number = 4284809178;
  static readonly tealAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._tealAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4289200107)],
      [200, constSourceColor(Color, Colors._tealAccentPrimaryValue)],
      [400, constSourceColor(Color, 4280150454)],
      [700, constSourceColor(Color, 4278239141)],
    ]),
  );
  private static readonly _greenPrimaryValue: number = 4283215696;
  static readonly green: MaterialColor = new MaterialColor(
    Colors._greenPrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4293457385)],
      [100, constSourceColor(Color, 4291356361)],
      [200, constSourceColor(Color, 4289058471)],
      [300, constSourceColor(Color, 4286695300)],
      [400, constSourceColor(Color, 4284922730)],
      [500, constSourceColor(Color, Colors._greenPrimaryValue)],
      [600, constSourceColor(Color, 4282622023)],
      [700, constSourceColor(Color, 4281896508)],
      [800, constSourceColor(Color, 4281236786)],
      [900, constSourceColor(Color, 4279983648)],
    ]),
  );
  private static readonly _greenAccentPrimaryValue: number = 4285132974;
  static readonly greenAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._greenAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4290377418)],
      [200, constSourceColor(Color, Colors._greenAccentPrimaryValue)],
      [400, constSourceColor(Color, 4278249078)],
      [700, constSourceColor(Color, 4278241363)],
    ]),
  );
  private static readonly _lightGreenPrimaryValue: number = 4287349578;
  static readonly lightGreen: MaterialColor = new MaterialColor(
    Colors._lightGreenPrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4294047977)],
      [100, constSourceColor(Color, 4292668872)],
      [200, constSourceColor(Color, 4291158437)],
      [300, constSourceColor(Color, 4289648001)],
      [400, constSourceColor(Color, 4288466021)],
      [500, constSourceColor(Color, Colors._lightGreenPrimaryValue)],
      [600, constSourceColor(Color, 4286362434)],
      [700, constSourceColor(Color, 4285046584)],
      [800, constSourceColor(Color, 4283796271)],
      [900, constSourceColor(Color, 4281559326)],
    ]),
  );
  private static readonly _lightGreenAccentPrimaryValue: number = 4289920857;
  static readonly lightGreenAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._lightGreenAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4291624848)],
      [200, constSourceColor(Color, Colors._lightGreenAccentPrimaryValue)],
      [400, constSourceColor(Color, 4285988611)],
      [700, constSourceColor(Color, 4284800279)],
    ]),
  );
  private static readonly _limePrimaryValue: number = 4291681337;
  static readonly lime: MaterialColor = new MaterialColor(
    Colors._limePrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4294573031)],
      [100, constSourceColor(Color, 4293981379)],
      [200, constSourceColor(Color, 4293324444)],
      [300, constSourceColor(Color, 4292667253)],
      [400, constSourceColor(Color, 4292141399)],
      [500, constSourceColor(Color, Colors._limePrimaryValue)],
      [600, constSourceColor(Color, 4290824755)],
      [700, constSourceColor(Color, 4289705003)],
      [800, constSourceColor(Color, 4288584996)],
      [900, constSourceColor(Color, 4286740247)],
    ]),
  );
  private static readonly _limeAccentPrimaryValue: number = 4293852993;
  static readonly limeAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._limeAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4294246273)],
      [200, constSourceColor(Color, Colors._limeAccentPrimaryValue)],
      [400, constSourceColor(Color, 4291231488)],
      [700, constSourceColor(Color, 4289653248)],
    ]),
  );
  private static readonly _yellowPrimaryValue: number = 4294961979;
  static readonly yellow: MaterialColor = new MaterialColor(
    Colors._yellowPrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4294966759)],
      [100, constSourceColor(Color, 4294965700)],
      [200, constSourceColor(Color, 4294964637)],
      [300, constSourceColor(Color, 4294963574)],
      [400, constSourceColor(Color, 4294962776)],
      [500, constSourceColor(Color, Colors._yellowPrimaryValue)],
      [600, constSourceColor(Color, 4294826037)],
      [700, constSourceColor(Color, 4294688813)],
      [800, constSourceColor(Color, 4294551589)],
      [900, constSourceColor(Color, 4294278935)],
    ]),
  );
  private static readonly _yellowAccentPrimaryValue: number = 4294967040;
  static readonly yellowAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._yellowAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4294967181)],
      [200, constSourceColor(Color, Colors._yellowAccentPrimaryValue)],
      [400, constSourceColor(Color, 4294961664)],
      [700, constSourceColor(Color, 4294956544)],
    ]),
  );
  private static readonly _amberPrimaryValue: number = 4294951175;
  static readonly amber: MaterialColor = new MaterialColor(
    Colors._amberPrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4294965473)],
      [100, constSourceColor(Color, 4294962355)],
      [200, constSourceColor(Color, 4294959234)],
      [300, constSourceColor(Color, 4294956367)],
      [400, constSourceColor(Color, 4294953512)],
      [500, constSourceColor(Color, Colors._amberPrimaryValue)],
      [600, constSourceColor(Color, 4294947584)],
      [700, constSourceColor(Color, 4294942720)],
      [800, constSourceColor(Color, 4294938368)],
      [900, constSourceColor(Color, 4294930176)],
    ]),
  );
  private static readonly _amberAccentPrimaryValue: number = 4294956864;
  static readonly amberAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._amberAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4294960511)],
      [200, constSourceColor(Color, Colors._amberAccentPrimaryValue)],
      [400, constSourceColor(Color, 4294951936)],
      [700, constSourceColor(Color, 4294945536)],
    ]),
  );
  private static readonly _orangePrimaryValue: number = 4294940672;
  static readonly orange: MaterialColor = new MaterialColor(
    Colors._orangePrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4294964192)],
      [100, constSourceColor(Color, 4294959282)],
      [200, constSourceColor(Color, 4294954112)],
      [300, constSourceColor(Color, 4294948685)],
      [400, constSourceColor(Color, 4294944550)],
      [500, constSourceColor(Color, Colors._orangePrimaryValue)],
      [600, constSourceColor(Color, 4294675456)],
      [700, constSourceColor(Color, 4294278144)],
      [800, constSourceColor(Color, 4293880832)],
      [900, constSourceColor(Color, 4293284096)],
    ]),
  );
  private static readonly _orangeAccentPrimaryValue: number = 4294945600;
  static readonly orangeAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._orangeAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4294955392)],
      [200, constSourceColor(Color, Colors._orangeAccentPrimaryValue)],
      [400, constSourceColor(Color, 4294938880)],
      [700, constSourceColor(Color, 4294929664)],
    ]),
  );
  private static readonly _deepOrangePrimaryValue: number = 4294924066;
  static readonly deepOrange: MaterialColor = new MaterialColor(
    Colors._deepOrangePrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4294699495)],
      [100, constSourceColor(Color, 4294954172)],
      [200, constSourceColor(Color, 4294945681)],
      [300, constSourceColor(Color, 4294937189)],
      [400, constSourceColor(Color, 4294930499)],
      [500, constSourceColor(Color, Colors._deepOrangePrimaryValue)],
      [600, constSourceColor(Color, 4294201630)],
      [700, constSourceColor(Color, 4293282329)],
      [800, constSourceColor(Color, 4292363029)],
      [900, constSourceColor(Color, 4290721292)],
    ]),
  );
  private static readonly _deepOrangeAccentPrimaryValue: number = 4294929984;
  static readonly deepOrangeAccent: MaterialAccentColor = new MaterialAccentColor(
    Colors._deepOrangeAccentPrimaryValue,
    new Map<number, Color>([
      [100, constSourceColor(Color, 4294942336)],
      [200, constSourceColor(Color, Colors._deepOrangeAccentPrimaryValue)],
      [400, constSourceColor(Color, 4294917376)],
      [700, constSourceColor(Color, 4292684800)],
    ]),
  );
  private static readonly _brownPrimaryValue: number = 4286141768;
  static readonly brown: MaterialColor = new MaterialColor(
    Colors._brownPrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4293913577)],
      [100, constSourceColor(Color, 4292332744)],
      [200, constSourceColor(Color, 4290554532)],
      [300, constSourceColor(Color, 4288776319)],
      [400, constSourceColor(Color, 4287458915)],
      [500, constSourceColor(Color, Colors._brownPrimaryValue)],
      [600, constSourceColor(Color, 4285353025)],
      [700, constSourceColor(Color, 4284301367)],
      [800, constSourceColor(Color, 4283315246)],
      [900, constSourceColor(Color, 4282263331)],
    ]),
  );
  private static readonly _greyPrimaryValue: number = 4288585374;
  static readonly grey: MaterialColor = new MaterialColor(
    Colors._greyPrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4294638330)],
      [100, constSourceColor(Color, 4294309365)],
      [200, constSourceColor(Color, 4293848814)],
      [300, constSourceColor(Color, 4292927712)],
      [350, constSourceColor(Color, 4292269782)],
      [400, constSourceColor(Color, 4290624957)],
      [500, constSourceColor(Color, Colors._greyPrimaryValue)],
      [600, constSourceColor(Color, 4285887861)],
      [700, constSourceColor(Color, 4284572001)],
      [800, constSourceColor(Color, 4282532418)],
      [850, constSourceColor(Color, 4281348144)],
      [900, constSourceColor(Color, 4280361249)],
    ]),
  );
  private static readonly _blueGreyPrimaryValue: number = 4284513675;
  static readonly blueGrey: MaterialColor = new MaterialColor(
    Colors._blueGreyPrimaryValue,
    new Map<number, Color>([
      [50, constSourceColor(Color, 4293718001)],
      [100, constSourceColor(Color, 4291811548)],
      [200, constSourceColor(Color, 4289773253)],
      [300, constSourceColor(Color, 4287669422)],
      [400, constSourceColor(Color, 4286091420)],
      [500, constSourceColor(Color, Colors._blueGreyPrimaryValue)],
      [600, constSourceColor(Color, 4283723386)],
      [700, constSourceColor(Color, 4282735204)],
      [800, constSourceColor(Color, 4281812815)],
      [900, constSourceColor(Color, 4280693304)],
    ]),
  );
  static readonly primaries: readonly MaterialColor[] = Object.freeze([
    Colors.red,
    Colors.pink,
    Colors.purple,
    Colors.deepPurple,
    Colors.indigo,
    Colors.blue,
    Colors.lightBlue,
    Colors.cyan,
    Colors.teal,
    Colors.green,
    Colors.lightGreen,
    Colors.lime,
    Colors.yellow,
    Colors.amber,
    Colors.orange,
    Colors.deepOrange,
    Colors.brown,
    Colors.blueGrey,
  ]);
  static readonly accents: readonly MaterialAccentColor[] = Object.freeze([
    Colors.redAccent,
    Colors.pinkAccent,
    Colors.purpleAccent,
    Colors.deepPurpleAccent,
    Colors.indigoAccent,
    Colors.blueAccent,
    Colors.lightBlueAccent,
    Colors.cyanAccent,
    Colors.tealAccent,
    Colors.greenAccent,
    Colors.lightGreenAccent,
    Colors.limeAccent,
    Colors.yellowAccent,
    Colors.amberAccent,
    Colors.orangeAccent,
    Colors.deepOrangeAccent,
  ]);
}
Object.freeze(Colors);
