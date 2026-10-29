// SPDX-License-Identifier: BSD-3-Clause
import {State, StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import type {BuildContext, Widget} from '@nelyx/core/framework/widgets/framework';
import {Column, Row, Expanded, Padding, Text, SizedBox, DecoratedBox} from '@nelyx/core/framework/widgets/basic';
import {LayoutBuilder} from '@nelyx/core/framework/widgets/layout-builder';
import {ListenableBuilder} from '@nelyx/core/framework/widgets/listenable-builder';
import {Wrap} from '@nelyx/core/framework/widgets/wrap';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {ValueKey} from '@nelyx/core/foundation/key';
import {GallerySection,GallerySectionExtents,GalleryUpdates} from './gallery-section.ts';
import {RepaintBoundary} from '@nelyx/core/framework/widgets/repaint-boundary';
import {ScrollController} from '@nelyx/core/framework/widgets/scroll-controller';
import {OverflowBar, OverflowBarAlignment} from '@nelyx/core/framework/widgets/overflow-bar';
import {MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {TextFieldTapRegion} from '@nelyx/core/framework/widgets/tap-region';
import {NavigatorController} from '@nelyx/core/framework/widgets/navigation';
import {createDialogRoute} from '@nelyx/core/framework/widgets/dialog';
import {RadioGroup} from '@nelyx/core/framework/widgets/radio-group';
import {Icon} from '@nelyx/core/framework/widgets/icon';
import type {IconData} from '@nelyx/core/framework/widgets/icon-data';
import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import {Color} from '@nelyx/core/ui/color';
import {CupertinoApp} from '@nelyx/cupertino/app';
import {CupertinoTheme, CupertinoThemeData} from '@nelyx/cupertino/theme';
import {CupertinoButton} from '@nelyx/cupertino/button';
import {CupertinoIcons} from '@nelyx/cupertino/icons';
import {CupertinoPageScaffold} from '@nelyx/cupertino/page-scaffold';
import {CupertinoCheckbox} from '@nelyx/cupertino/checkbox';
import {CupertinoRadio} from '@nelyx/cupertino/radio';
import {CupertinoSwitch} from '@nelyx/cupertino/switch';
import {CupertinoSlider} from '@nelyx/cupertino/slider';
import {CupertinoActivityIndicator} from '@nelyx/cupertino/activity-indicator';
import {CupertinoListTile, CupertinoListTileChevron} from '@nelyx/cupertino/list-tile';
import {CupertinoListSection} from '@nelyx/cupertino/list-section';
import {CupertinoTextField,OverlayVisibilityMode} from '@nelyx/cupertino/text-field';
import {CupertinoTextFormFieldRow} from '@nelyx/cupertino/text-form-field-row';
import {Form} from '@nelyx/core/framework/widgets/form';
import type {FormState} from '@nelyx/core/framework/widgets/form';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {CupertinoFormSection} from '@nelyx/cupertino/form-section';
import {CupertinoAlertDialog} from '@nelyx/cupertino/dialog';
import {categories} from './catalog.ts';
import type {CategoryId, ComponentDemo} from './catalog.ts';
import {cupertinoDemos, visibleCupertinoDemos} from './cupertino-catalog.ts';

const groups = categories.filter(group => group.id !== 'images');
const accents = [0xff007aff, 0xff248a3d, 0xffaf52de, 0xffc93400] as const;
const flow = (...children: Widget[]): Widget => new Wrap(children, {spacing: 8, runSpacing: 8, crossAxisAlignment: 'center'});
const column = (...children: Widget[]): Widget => new Column(children, {mainSize: 'min', crossAlign: 'stretch', spacing: 12});

/** The application owns these values across Material/Cupertino page replacement. */
export class CupertinoGalleryValues {
  readonly textScroll=new ScrollController();
  readonly text: TextEditingController;
  dark = false;
  accent: number = accents[0];
  category: CategoryId | 'all' = 'all';
  includePlanned = false;
  switched = false;
  checked: boolean | null = true;
  radio = 'first';
  slider = 40;
  animating = false;
  interactiveSelection = true;
  lastAction = 'Cupertino 컴포넌트를 눌러보세요.';
  constructor(initialText: string) {this.text = new TextEditingController(initialText);}
  dispose(): void {this.text.dispose();this.textScroll.dispose();}
}

export class CupertinoGallery extends StatefulWidget {
  constructor(readonly values: CupertinoGalleryValues, readonly onMaterial: () => void) {super();}
  createState(): State<CupertinoGallery> {return new CupertinoAppState();}
}
class CupertinoAppState extends State<CupertinoGallery> {
  private readonly navigator = new NavigatorController();
  override dispose(): void {this.navigator.dispose(); super.dispose();}
  build(): Widget {
    const v = this.widget.values;
    return new RepaintBoundary(new CupertinoApp({
      theme: new CupertinoThemeData({brightness: v.dark ? 'dark' : 'light', primaryColor: v.accent}),
      locale: 'ko-KR', supportedLocales: ['ko-KR', 'en'], navigatorController: this.navigator,
      routes: {'/details': () => new CupertinoRouteDemo(this.navigator)},
      home: new CupertinoGalleryPage(v, this.widget.onMaterial, this.navigator, () => this.setState(() => {})),
    }));
  }
}
class CupertinoRouteDemo extends StatefulWidget {
  constructor(readonly navigator: NavigatorController) {super();}
  createState(): State<CupertinoRouteDemo> {return new CupertinoRouteDemoState();}
}
class CupertinoRouteDemoState extends State<CupertinoRouteDemo> {
  private count = 0;
  build(): Widget {
    const back = () => {this.widget.navigator.pop(this.count);};
    return new CupertinoPageScaffold('Details', new Padding(EdgeInsets.all(20), column(
      new Text('Named route · count: ' + this.count),
      MediaQuery.withClampedTextScaling({maxScaleFactor: 1.5, child: new OverflowBar({spacing: 12, overflowSpacing: 8, overflowAlignment: OverflowBarAlignment.start, children: [
        new CupertinoButton({id: 'cupertino-route-increment', child: new Text('Increment'), onPressed: () => this.setState(() => {this.count++;})}),
        new CupertinoButton({id: 'cupertino-route-reset', child: new Text('Reset counter'), onPressed: () => this.setState(() => {this.count = 0;})}),
        new CupertinoButton({id: 'cupertino-route-return', child: new Text('Return result'), onPressed: back}),
      ]})}),
    )), back);
  }
}
class CupertinoGalleryPage extends StatefulWidget {
  constructor(readonly values: CupertinoGalleryValues, readonly onMaterial: () => void,
    readonly navigator: NavigatorController, readonly onThemeChanged: () => void) {super();}
  createState(): State<CupertinoGalleryPage> {return new CupertinoGalleryState();}
}
class CupertinoGalleryState extends State<CupertinoGalleryPage> {
  private pageRevision=0;
  private readonly updates=new GalleryUpdates();
  private readonly scroll = new ScrollController({debugLabel: 'cupertino-gallery'});
  private readonly extents=new GallerySectionExtents();
  private readonly sectionKeys = new Map(cupertinoDemos.map(demo => [demo.id, new ValueKey(demo.id)] as const));
  private get navigator(): NavigatorController {return this.widget.navigator;}
  private readonly radioToken = {};
  private get values(): CupertinoGalleryValues {return this.widget.values;}
  override dispose(): void {this.updates.dispose();this.scroll.dispose(); super.dispose();}
  private change(change: () => void): void {this.setState(change);this.updates.page.notifyListeners();}
  private changeTheme(change: () => void): void {this.change(change); this.widget.onThemeChanged();}
  private browse(change: () => void): void {
    this.extents.reset();
    this.change(change);
    if (this.scroll.hasClients) this.scroll.jumpTo(0);
  }
  private select(category: CategoryId | 'all'): void {
    this.browse(() => {this.values.category = category;});
  }
  private button(id: string, label: string, onPressed: (() => void) | null, selected = false): Widget {
    const options = {id, child: new Text(label), sizeStyle: 'small' as const, onPressed};
    return selected ? CupertinoButton.tinted(options) : new CupertinoButton(options);
  }
  private iconButton(id: string, label: string, data: IconData, onPressed: (() => void) | null, color?: number): Widget {
    return new CupertinoButton({id, semanticsLabel: label, child: new Icon(data, {size: 22, ...(color === undefined ? {} : {color: new Color(color)})}), sizeStyle: 'small', onPressed});
  }
  private record(message: string): void {this.values.lastAction=message;this.updates.status.notifyListeners();}
  private openDialog(): void {
    // The fixed content/action API remains basic; presentation uses Core's
    // shared modal barrier, result, focus and reverse-retirement policy.
    void this.navigator.push(createDialogRoute({builder: () => new CupertinoAlertDialog('Cupertino dialog',
      new Text('현재 공개된 기본 AlertDialog API 데모입니다.'), () => {void this.navigator.pop();},
    )})).then(() => {if (this.mounted) this.record('Cupertino dialog closed');}).catch(error => {
      if (this.mounted) this.record(String(error));
    });
  }
  private openRoute(): void {
    void this.navigator.pushNamed<number>('/details').then(result => {
      if (this.mounted) this.record('Cupertino route result: ' + (result ?? 'cancelled'));
    }).catch(error => {if (this.mounted) this.record(String(error));});
  }
  build(): Widget {
    ++this.pageRevision;
    let page:{mode:number;revision:number;theme:CupertinoThemeData;child:Widget}|undefined;
    return new RepaintBoundary(new ListenableBuilder(this.updates.page,()=>new LayoutBuilder((context, constraints) => {
      const compact=constraints.maxWidth<600,short=constraints.maxHeight<600,mode=Number(short)|Number(compact)<<1,theme=CupertinoTheme.of(context);
      if(!page||page.mode!==mode||page.revision!==this.pageRevision||!page.theme.equals(theme))page={mode,revision:this.pageRevision,theme,child:new CupertinoPageScaffold('Cupertino',this.page(context,compact,short))};
      return page.child;
    })));
  }
  private page(context: BuildContext, compact: boolean, short: boolean): Widget {
    const v = this.values, theme = CupertinoTheme.of(context);
    const catalog = visibleCupertinoDemos(v.category, v.includePlanned);
    const available = cupertinoDemos.filter(demo => demo.status !== 'planned').length;
    return new Column([
      new RepaintBoundary(new Padding(EdgeInsets.fromLTRB(16, short ? 4 : 12, 16, 8), short ? flow(
        this.button('show-material', 'Material 3', this.widget.onMaterial),
        new TextFieldTapRegion(this.iconButton('cupertino-toggle-theme', v.dark ? 'Light mode' : 'Dark mode', v.dark ? CupertinoIcons.sun_max : CupertinoIcons.moon, () => this.changeTheme(() => {v.dark = !v.dark;}))),
        new Text(v.category==='all'?'Cupertino':groups.find(group=>group.id===v.category)!.title,{fontSize:16}),
      ) : column(
        flow(
          this.button('show-material', 'Material 3', this.widget.onMaterial),
          new TextFieldTapRegion(this.iconButton('cupertino-toggle-theme', v.dark ? 'Light mode' : 'Dark mode', v.dark ? CupertinoIcons.sun_max : CupertinoIcons.moon, () => this.changeTheme(() => {v.dark = !v.dark;}))),
          new Text(available + '개 데모 · ' + (cupertinoDemos.length - available) + '개 준비 중', {fontSize: 12}),
        ),
        flow(...accents.map((accent, index) => this.iconButton('cupertino-accent-' + index,
          ['Blue', 'Green', 'Purple', 'Orange'][index]!, v.accent === accent ? CupertinoIcons.check_mark_circled_solid : CupertinoIcons.circle_fill, () => this.changeTheme(() => {v.accent = accent;}), accent))),
        flow(this.button('cupertino-category-all', 'All', () => this.select('all'), v.category === 'all'),
          ...groups.map(group => this.button('cupertino-category-' + group.id, group.title, () => this.select(group.id), v.category === group.id))),
        flow(
          this.button('cupertino-toggle-planned', v.includePlanned ? '데모만 보기' : '준비 중 포함', () => this.browse(() => {v.includePlanned = !v.includePlanned;})),
          new Text(catalog.length + '개 섹션 · 스크롤하여 탐색', {fontSize: 12}),
        ),
      ))),
      // The same lazy list/editor owner survives width changes and scrolling.
      new Expanded(ListView.builder({
        extentIndex:this.extents.forItems(catalog.map(demo=>demo.id)),metricRevision:theme,
        childPolicy:{mode:'bounded',capacity:2,preparation:'disabled'},
        controller: this.scroll, primary: false,
        findChildIndexCallback: key => {const index = catalog.findIndex(demo => this.sectionKeys.get(demo.id) === key); return index < 0 ? null : index;},
        padding: EdgeInsets.all(compact ? 16 : 28), itemCount: catalog.length,
        itemBuilder: (_itemContext, index) => {const demo = catalog[index]!; return new GallerySection(new ListenableBuilder(this.updates.section(demo.id),context=>this.section(context,demo)), demo.id === 'text-field', this.sectionKeys.get(demo.id)!);},
      })),
      new RepaintBoundary(new Padding(EdgeInsets.symmetric({horizontal: 16, vertical: 12}), new ListenableBuilder(this.updates.status,context=>new Text(v.lastAction, {fontSize: 12, maxLines: 2, color: CupertinoTheme.of(context).textTheme.textStyle.color ?? undefined})))),
    ], {crossAlign: 'stretch'});
  }
  private section(context: BuildContext, demo: ComponentDemo): Widget {
    const theme = CupertinoTheme.of(context);
    return new Padding(EdgeInsets.only({bottom: 16}), new DecoratedBox(new Padding(EdgeInsets.all(20), column(
      new Row([
        new Expanded(new Text(demo.title, {fontSize: 20})),
        ...(demo.status === 'ready' ? [] : [new Text(demo.status === 'basic' ? '기본 API' : '준비 중', {fontSize: 11})]),
      ], {spacing: 12, crossAlign: 'center'}),
      demo.status === 'planned' ? new Text('제품 구현 후 실제 사용 흐름을 연결할 예정입니다.', {fontSize: 13}) : this.demo(demo.id),
    )), theme.barBackgroundColor, 14));
  }
  private demo(id: string): Widget {
    const update=(change:()=>void)=>this.updates.change(id,change,id==='sliders'?['activity']:[]);
    const v = this.values;
    switch (id) {
      case 'buttons': return flow(
        CupertinoButton.filled({id: 'cupertino-filled', child: new Text('Filled'), onPressed: () => this.record('Cupertino filled pressed')}),
        CupertinoButton.tinted({id: 'cupertino-tinted', child: new Text('Tinted'), onPressed: () => this.record('Cupertino tinted pressed')}),
        this.button('cupertino-plain', 'Plain', () => this.record('Cupertino plain pressed')),
        new CupertinoButton({id: 'cupertino-heart', child: new Icon(CupertinoIcons.heart, {size: 24}), semanticsLabel: 'Favorite', onPressed: () => this.record('Cupertino favorite pressed')}),
        this.button('cupertino-disabled', 'Disabled', null),
      );
      case 'activity': return column(flow(
        new RepaintBoundary(new CupertinoActivityIndicator({animating: v.animating, radius: 14})),
        CupertinoActivityIndicator.partiallyRevealed({progress: v.slider / 100, radius: 14}),
        this.button('cupertino-toggle-activity', v.animating ? 'Stop animation' : 'Start animation', () => update(() => {v.animating = !v.animating;})),
      ), new Text('Partial reveal: ' + Math.round(v.slider) + '%', {fontSize: 13}));
      case 'lists': return CupertinoListSection.insetGrouped({
        header: new Text('설정'), hasLeading: false,
        children: [
          new CupertinoListTile({id: 'cupertino-list-notifications', title: new Text('알림'), trailing: new CupertinoListTileChevron(), onTap: () => this.record('Notifications selected')}),
          new CupertinoListTile({id: 'cupertino-list-appearance', title: new Text('화면 모드'), additionalInfo: new Text(v.dark ? 'Dark' : 'Light'), onTap: () => this.changeTheme(() => {v.dark = !v.dark;})}),
        ],
      });
      case 'dialog': return column(new Text('고정 Close action을 제공하는 기본 API입니다.', {fontSize: 13}), this.button('cupertino-open-dialog', 'Open dialog', () => this.openDialog()));
      case 'navigation': return column(new Text('이 페이지는 실제 CupertinoApp · PageScaffold · NavigationBar를 사용합니다.', {fontSize: 14}),
        this.button('cupertino-open-route', 'Open named route', () => this.openRoute()),
        new Text('기본 page route · 뒤로가기 · 결과 반환을 확인하세요. large title · tab은 W13 잔여 작업입니다.', {fontSize: 13}));
      case 'switches': return flow(new CupertinoSwitch({id: 'cupertino-switch', value: v.switched, semanticLabel: 'Cupertino switch', onChanged: value => update(() => {v.switched = value;})}),
        new Text(v.switched ? 'On' : 'Off'), new CupertinoSwitch({id: 'cupertino-switch-disabled', value: true, onChanged: null}));
      case 'checkboxes': return flow(new CupertinoCheckbox({id: 'cupertino-checkbox', value: v.checked, tristate: true, semanticLabel: 'Cupertino checkbox', onChanged: value => update(() => {v.checked = value;})}),
        new Text(v.checked === null ? 'Mixed' : v.checked ? 'Checked' : 'Unchecked'), new CupertinoCheckbox({id: 'cupertino-checkbox-disabled', value: false, onChanged: null}));
      case 'radios': return new RadioGroup<string>({typeToken: this.radioToken, groupValue: v.radio, onChanged: value => update(() => {if (value !== null) v.radio = value;}),
        child: column(flow(...['first', 'second'].map(value => new Row([new CupertinoRadio({id: 'cupertino-radio-' + value, value, groupToken: this.radioToken, semanticLabel: value}), new Text(value)], {mainSize: 'min', crossAlign: 'center', spacing: 8}))), new Text('Selected: ' + v.radio))});
      case 'sliders': return column(new CupertinoSlider({id: 'cupertino-slider', value: v.slider, min: 0, max: 100, divisions: 10, onChanged: value => update(() => {v.slider = value;})}),
        new Text('Value: ' + Math.round(v.slider)), new CupertinoSlider({id: 'cupertino-slider-disabled', value: 50, min: 0, max: 100, onChanged: null}));
      case 'text-field': return column(
        new CupertinoTextField({id:'cupertino-field',controller:v.text,scrollController:v.textScroll,enableInteractiveSelection:v.interactiveSelection,placeholder:'메시지를 입력하세요',minLines:1,maxLines:3,maxLength:20,clearButtonMode:OverlayVisibilityMode.editing,clearButtonSemanticLabel:'Clear Cupertino message',prefix:new Padding(EdgeInsets.only({left:7}),new Text('Note')),onSubmitted:()=>this.record('Cupertino message submitted')}),
        new Text('20 grapheme · Enter로 줄바꿈 · Ctrl/Meta+Enter로 제출', {fontSize:12}),
        new TextFieldTapRegion(flow(this.button('cupertino-undo-message','Undo Cupertino message',()=>{v.text.undo();}),this.button('cupertino-toggle-selection',v.interactiveSelection?'Disable selection':'Enable selection',()=>{update(()=>{v.interactiveSelection=!v.interactiveSelection;});}))),
        new TextFieldTapRegion(flow(...[false,true].map(end=>new CupertinoButton({id:end?'cupertino-scroll-end':'cupertino-scroll-top',child:new Text(end?'Scroll to end':'Scroll to top'),sizeStyle:'small',requestFocusOnPointer:false,onPressed:()=>{if(v.textScroll.hasClients&&v.textScroll.position.hasContentDimensions){v.textScroll.jumpTo(end?v.textScroll.position.maxScrollExtent:0);this.record(end?'Cupertino scroll end':'Cupertino scroll top');}}})))),
        new CupertinoFormDemo(),
      );
      default: throw new Error('No Cupertino demo for ' + id);
    }
  }
}

class CupertinoFormDemo extends StatefulWidget {
  createState():State<CupertinoFormDemo>{return new CupertinoFormDemoState();}
}
class CupertinoFormDemoState extends State<CupertinoFormDemo> {
  private readonly formKey=new GlobalKey<FormState>('Cupertino input form');
  private savedName='';private savedEmail='';private status='이름과 이메일을 입력한 뒤 저장하세요.';
  private readonly save=()=>{const form=this.formKey.currentState;if(!form)return;const valid=form.validate();if(valid)form.save();this.setState(()=>{this.status=valid?`Cupertino saved: ${this.savedName} · ${this.savedEmail}`:'필수 항목과 이메일 형식을 확인하세요.';});};
  build():Widget{return new Form({key:this.formKey,autovalidateMode:'onUserInteraction',child:column(
    CupertinoFormSection.insetGrouped({header:new Text('연락처'),footer:new Text('위쪽 메시지는 화면을 이동해도 유지됩니다. 연락처는 이 페이지에서 저장하세요.'),children:[
      new CupertinoTextFormFieldRow({id:'cupertino-form-name',prefix:new Text('Name'),placeholder:'Cupertino name',textInputAction:'next',autofillHints:['name'],validator:value=>value.trim()?null:'이름을 입력하세요.',onSaved:value=>{this.savedName=value;}}),
      new CupertinoTextFormFieldRow({id:'cupertino-form-email',prefix:new Text('Email'),placeholder:'Cupertino email',keyboardType:'email',textInputAction:'done',autofillHints:['email'],validator:value=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)?null:'이메일 형식을 확인하세요.',onSaved:value=>{this.savedEmail=value;},onFieldSubmitted:this.save}),
    ]}),
    flow(new CupertinoButton({id:'cupertino-form-save',child:new Text('Save Cupertino form'),onPressed:this.save}),new CupertinoButton({id:'cupertino-form-reset',child:new Text('Reset Cupertino form'),onPressed:()=>{this.formKey.currentState?.reset();this.setState(()=>{this.status='Cupertino form reset';});}})),
    new Text(this.status,{fontSize:12}),
  )});}
}
