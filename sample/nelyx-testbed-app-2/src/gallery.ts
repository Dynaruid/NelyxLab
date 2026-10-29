// SPDX-License-Identifier: BSD-3-Clause
import {State, StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import {ValueKey} from '@nelyx/core/foundation/key';
import type {BuildContext, Widget} from '@nelyx/core/framework/widgets/framework';
import {Column, Row, Expanded, Padding, Text, SizedBox, DecoratedBox, Center} from '@nelyx/core/framework/widgets/basic';
import {LayoutBuilder} from '@nelyx/core/framework/widgets/layout-builder';
import {ListenableBuilder} from '@nelyx/core/framework/widgets/listenable-builder';
import {Wrap} from '@nelyx/core/framework/widgets/wrap';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {RepaintBoundary} from '@nelyx/core/framework/widgets/repaint-boundary';
import {FocusTraversalGroup} from '@nelyx/core/framework/widgets/focus-traversal-group';
import {ScrollController} from '@nelyx/core/framework/widgets/scroll-controller';
import {TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {TextFieldTapRegion} from '@nelyx/core/framework/widgets/tap-region';
import {NavigatorController, Route} from '@nelyx/core/framework/widgets/navigation';
import {RadioGroup} from '@nelyx/core/framework/widgets/radio-group';
import {Icon} from '@nelyx/core/framework/widgets/icon';
import type {IconData} from '@nelyx/core/framework/widgets/icon-data';
import {Image} from '@nelyx/core/framework/widgets/image';
import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import {Color} from '@nelyx/core/ui/color';
import {MaterialApp} from '@nelyx/material/app';
import {Theme} from '@nelyx/material/theme';
import {ThemeData} from '@nelyx/material/theme-data';
import {ColorScheme} from '@nelyx/material/color-scheme';
import {FilledButton} from '@nelyx/material/filled-button';
import {ElevatedButton} from '@nelyx/material/elevated-button';
import {OutlinedButton} from '@nelyx/material/outlined-button';
import {TextButton} from '@nelyx/material/text-button';
import {IconButton} from '@nelyx/material/icon-button';
import {Icons} from '@nelyx/material/icons';
import {Card} from '@nelyx/material/card';
import {Badge} from '@nelyx/material/badge';
import {Divider} from '@nelyx/material/divider';
import {Checkbox} from '@nelyx/material/checkbox';
import {Radio} from '@nelyx/material/radio';
import {Switch} from '@nelyx/material/switch';
import {Slider} from '@nelyx/material/slider';
import {RangeSlider} from '@nelyx/material/range-slider';
import {RangeValues} from '@nelyx/material/range-slider-values';
import {LinearProgressIndicator, CircularProgressIndicator} from '@nelyx/material/progress-indicator';
import {ActionChip} from '@nelyx/material/action-chip';
import {ChoiceChip} from '@nelyx/material/choice-chip';
import {FilterChip} from '@nelyx/material/filter-chip';
import {TextField} from '@nelyx/material/text-field';
import {TextFormField} from '@nelyx/material/text-form-field';
import {Form} from '@nelyx/core/framework/widgets/form';
import type {FormState} from '@nelyx/core/framework/widgets/form';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {InputDecoration} from '@nelyx/material/input-decoration';
import {OutlineInputBorder} from '@nelyx/material/input-border';
import {AlertDialog, showDialog} from '@nelyx/material/dialog';
import {categories, demos, visibleDemos} from './catalog.ts';
import type {CategoryId, ComponentDemo} from './catalog.ts';
import {CupertinoGallery, CupertinoGalleryValues} from './cupertino-gallery.ts';
import {GallerySection,GallerySectionExtents,GalleryUpdates} from './gallery-section.ts';
import {ListViewPage} from './list-view.ts';

const available = demos.filter(demo => demo.status !== 'planned').length;
const seeds = [0xff6750a4, 0xff006c4c, 0xff0061a4, 0xff9c4230] as const;
const categoryIcons: Record<CategoryId, IconData> = {
  actions: Icons.touch_app, communication: Icons.notifications_none,
  containment: Icons.dashboard_outlined, navigation: Icons.explore_outlined,
  selection: Icons.tune, text: Icons.text_fields, images: Icons.image_outlined,
};
const icon = (data: IconData, color?: number, size = 22): Icon => new Icon(data, {size, ...(color === undefined ? {} : {color: new Color(color)})});
const flow = (...children: Widget[]): Widget => new Wrap(children, {spacing: 10, runSpacing: 10, crossAxisAlignment: 'center'});
const column = (...children: Widget[]): Widget => new Column(children, {mainSize: 'min', crossAlign: 'stretch', spacing: 12});
const inset = (value: number, child: Widget): Widget => new Padding(EdgeInsets.all(value), child);

export class ComponentsGallery extends StatefulWidget {
  constructor(readonly initialText = '안녕하세요, Nelyx!') {super();}
  createState(): State<ComponentsGallery> {return new GalleryState();}
}
class GalleryState extends State<ComponentsGallery> {
  private pageRevision=0;
  private readonly updates=new GalleryUpdates();
  private cupertino = false;
  private pendingDesign: boolean | null = null;
  private cupertinoValues!: CupertinoGalleryValues;
  private dark = false;
  private seed: number = seeds[0];
  private themeCache:{seed:number;dark:boolean;data:ThemeData}|undefined;
  private category: CategoryId | 'all' = 'all';
  private includePlanned = false;
  private lastAction = '컴포넌트를 눌러 동작을 살펴보세요.';
  private actionCount = 0;
  private readonly firstScroll = new ScrollController({debugLabel: 'material-gallery-first'});
  private readonly secondScroll = new ScrollController({debugLabel: 'material-gallery-second'});
  private readonly firstExtents=new GallerySectionExtents();private readonly secondExtents=new GallerySectionExtents();
  private readonly sectionKeys = new Map(demos.map(demo => [demo.id, demo.id === 'text-fields' ? new GlobalKey('Material editor section') : new ValueKey(demo.id)] as const));
  private readonly messageScroll = new ScrollController();
  private navigator = new NavigatorController();
  private readonly radioToken = {};
  private filled!: TextEditingController;
  private outlined!: TextEditingController;
  private multilineMessage=true;
  private obscureMessage=false;
  private interactiveMessage=true;
  private checked: boolean | null = true;
  private mixed: boolean | null = null;
  private selectedRadio = 'first';
  private switched = false;
  private favorite = false;
  private chip = 'Day';
  private filtered = true;
  private slider = 30;
  private range = new RangeValues(20, 80);
  private progress = false;
  private messages = 9;
  private imageCover = true;
  override initState(): void {
    this.cupertinoValues = new CupertinoGalleryValues(this.widget.initialText);
    this.filled = new TextEditingController(this.widget.initialText);
    this.outlined = new TextEditingController('Material 3');
  }
  override dispose(): void {
    this.updates.dispose();
    this.cupertinoValues.dispose();
    this.firstScroll.dispose(); this.secondScroll.dispose(); this.messageScroll.dispose(); this.navigator.dispose();
    this.filled.dispose(); this.outlined.dispose(); super.dispose();
  }
  private record(action: string): void {
    this.lastAction = action; this.actionCount++;this.updates.status.notifyListeners();
  }
  private changePage(change:()=>void):void{this.setState(change);this.updates.page.notifyListeners();}
  private select(category: CategoryId | 'all'): void {
    this.firstExtents.reset();this.secondExtents.reset();
    this.changePage(() => {this.category = category;});
    for (const controller of [this.firstScroll, this.secondScroll]) if (controller.hasClients) controller.jumpTo(0);
  }
  private showDesign(cupertino: boolean): void {
    // Retire the current App/editor tree before mounting another design App.
    // This keeps both live paragraph producers and borrowed editors bounded.
    this.changePage(() => {this.pendingDesign = cupertino;});
  }
  private readonly designRetired = (): void => {
    if (this.mounted && this.pendingDesign !== null) this.changePage(() => {
      if (this.pendingDesign) {this.navigator.dispose(); this.navigator = new NavigatorController();}
      this.cupertino = this.pendingDesign!; this.pendingDesign = null;
    });
  };
  private openDialog(): void {
    void showDialog(this.navigator, () => new AlertDialog('gallery-dialog', 'Dialog',
      new Text('현재 공개된 기본 Dialog API 데모입니다.'), () => {void this.navigator.pop();},
    )).then(() => {if (this.mounted) this.record('Dialog closed');}).catch(error => {
      if (this.mounted) this.record(String(error));
    });
  }
  private openListView(): void {
    // Use an immediate opaque route so the two dense demos do not paint together.
    void this.navigator.push(new Route(() => new ListViewPage(() => {void this.navigator.pop();}), '/list-view')).catch(error => {
      if (this.mounted) this.record(String(error));
    });
  }
  build(): Widget {
    ++this.pageRevision;
    if (this.pendingDesign !== null) return new SizedBox();
    if (this.cupertino) return new DesignSession(new CupertinoGallery(this.cupertinoValues, () => this.showDesign(false)), this.designRetired);
    // Value changes do not replace the inherited theme or the section metric
    // revision. Recompute the palette only when its actual inputs change.
    if(!this.themeCache||this.themeCache.seed!==this.seed||this.themeCache.dark!==this.dark)this.themeCache={seed:this.seed,dark:this.dark,data:new ThemeData({colorScheme:ColorScheme.fromSeed({seedColor:this.seed,brightness:this.dark?'dark':'light'}),fontFamily:'NelyxSample'})};
    const theme=this.themeCache.data;
    let page:{mode:number;revision:number;theme:ThemeData;child:Widget}|undefined;
    return new DesignSession(new RepaintBoundary(new MaterialApp({
      theme, locale: 'ko-KR', supportedLocales: ['ko-KR', 'en'], navigatorController: this.navigator,
      home: new RepaintBoundary(new ListenableBuilder(this.updates.page,()=>new LayoutBuilder((context, constraints) => {
        const short=constraints.maxHeight<600,wide=constraints.maxWidth>=1120&&!short,compact=constraints.maxWidth<600,mode=Number(short)|Number(wide)<<1|Number(compact)<<2,resolved=Theme.of(context);
        // The render tree receives every constraint change. Widget structure
        // changes only at a breakpoint, on theme changes, or on a State build.
        if(!page||page.mode!==mode||page.revision!==this.pageRevision||page.theme!==resolved)page={mode,revision:this.pageRevision,theme:resolved,child:this.page(context,compact,short,wide)};
        return page.child;
      }))),
    })), this.designRetired);
  }
  private page(context: BuildContext, compact: boolean, short: boolean, wide: boolean): Widget {
    const theme=Theme.of(context),colors = theme.colorScheme;
    const catalog = visibleDemos(this.category, this.includePlanned || this.category === 'navigation');
    // The editor always belongs to the primary scroll owner, including after a
    // filter/column change. Stable keys remap its lazy index without rebinding it.
    const primary = catalog.filter((demo, index) => demo.id === 'text-fields' || index % 2 === 0);
    const secondary = catalog.filter((demo, index) => demo.id !== 'text-fields' && index % 2 !== 0);
    const twoColumns = wide && this.category === 'all';
    const list = (items: readonly ComponentDemo[], controller: ScrollController): Widget => ListView.builder({
      extentIndex:(controller===this.firstScroll?this.firstExtents:this.secondExtents).forItems(items.map(demo=>demo.id)),metricRevision:theme,
      childPolicy:{mode:'bounded',capacity:2,preparation:'disabled'},
      controller, primary: false, padding: EdgeInsets.fromLTRB(0, 0, 0, 20),
      findChildIndexCallback: key => {const index = items.findIndex(demo => this.sectionKeys.get(demo.id) === key); return index < 0 ? null : index;},
      itemCount: items.length, itemBuilder: (itemContext, index) => {
        const demo = items[index]!;
        return new GallerySection(new ListenableBuilder(this.updates.section(demo.id),context=>this.group(context,demo,index===0||items[index-1]!.category!==demo.category)), demo.id === 'text-fields', this.sectionKeys.get(demo.id)!);
      },
    });
    const content = new Row([
      new Expanded(list(twoColumns ? primary : catalog, this.firstScroll)),
      new SizedBox(twoColumns ? 20 : 0),
      twoColumns ? new Expanded(list(secondary, this.secondScroll)) : new SizedBox(0),
    ], {crossAlign: 'stretch'});
    const title=this.category === 'all' ? 'Components' : categories.find(group => group.id === this.category)!.title;
    const themeButton=()=>new TextFieldTapRegion(new IconButton({id: 'toggle-theme', icon: icon(this.dark ? Icons.light_mode : Icons.dark_mode), tooltip: this.dark ? 'Light mode' : 'Dark mode', onPressed: () => this.changePage(() => {this.dark = !this.dark;})}));
    const designButton=()=>new TextButton({id: 'show-cupertino', child: new Text('Cupertino'), onPressed: () => this.showDesign(true)});
    const listButton=()=>new TextButton({id: 'show-list-view', child: new Text('ListView'), onPressed: () => this.openListView()});
    const heading = new Padding(EdgeInsets.fromLTRB(compact ? 16 : 28, short ? 8 : 18, compact ? 16 : 28, short ? 8 : 16), short ? new Row([
      new Expanded(new Text(title,{fontSize:18})),listButton(),designButton(),themeButton(),
    ],{crossAlign:'center',spacing:8}) : column(
      new Row([
        new Expanded(column(
          new Text(title, {fontSize: compact ? 28 : 36}),
          new Text('직접 만져보는 Material 3 컴포넌트', {fontSize: 14, color: colors.onSurfaceVariant}),
        )),
        listButton(),
        themeButton(),
      ], {crossAlign: 'center', spacing: 12}),
      flow(
        designButton(),
        new Text(available + '개 데모 · ' + (demos.length - available) + '개 준비 중', {fontSize: 12, color: colors.onSurfaceVariant}),
        ...seeds.map((seed, index) => new IconButton({
          id: 'seed-' + index, icon: icon(this.seed === seed ? Icons.check_circle : Icons.circle, seed, 23),
          tooltip: ['Purple theme', 'Green theme', 'Blue theme', 'Coral theme'][index]!,
          onPressed: () => this.changePage(() => {this.seed = seed;}),
        })),
        new TextButton({id: 'toggle-planned', child: new Text(this.includePlanned ? '데모만 보기' : '준비 중 포함'), onPressed: () => {this.firstExtents.reset();this.secondExtents.reset();this.changePage(() => {this.includePlanned = !this.includePlanned;}); for (const controller of [this.firstScroll, this.secondScroll]) if (controller.hasClients) controller.jumpTo(0);}}),
        new Text(catalog.length + '개 섹션 · 스크롤하여 탐색', {fontSize: 12, color: colors.onSurfaceVariant}),
      ),
    ));
    return new DecoratedBox(new Row([
      new SizedBox(wide ? 220 : 0, undefined, wide ? new FocusTraversalGroup(new RepaintBoundary(this.sidebar(context))) : new SizedBox()),
      new Expanded(new FocusTraversalGroup(this.main(context, heading, content, compact, wide, short))),
    ], {crossAlign: 'stretch'}), colors.surface);
  }
  private main(context: BuildContext, heading: Widget, content: Widget, compact: boolean, wide: boolean, short: boolean): Widget {
    return new Column([
      new RepaintBoundary(heading),
      wide || short ? new SizedBox(undefined, 0) : new RepaintBoundary(new Padding(EdgeInsets.symmetric({horizontal: 16}), flow(
        this.categoryButton('all', 'All'), ...categories.map(group => this.categoryButton(group.id, group.title)),
      ))),
      new Expanded(new Padding(EdgeInsets.fromLTRB(compact ? 16 : 28, compact ? 12 : 4, compact ? 16 : 28, 0), content)),
      new RepaintBoundary(new Padding(EdgeInsets.symmetric({horizontal: compact ? 16 : 28, vertical: 12}),
        new ListenableBuilder(this.updates.status,context=>new Text((this.actionCount ? this.actionCount + ' · ' : '') + this.lastAction, {fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant, maxLines: 2})))),
    ], {crossAlign: 'stretch'});
  }
  private categoryButton(category: CategoryId | 'all', label: string): Widget {
    const options = {id: 'category-' + category, child: new Text(label), onPressed: () => this.select(category)};
    return this.category === category ? FilledButton.tonal(options) : new TextButton(options);
  }
  private sidebar(context: BuildContext): Widget {
    const colors = Theme.of(context).colorScheme;
    return new DecoratedBox(inset(20, new Column([
      new Padding(EdgeInsets.symmetric({vertical: 20}), new Row([icon(Icons.widgets, colors.primary, 32), new Text('Nelyx', {fontSize: 26})], {spacing: 12, mainSize: 'min'})),
      new SizedBox(undefined, 24),
      this.categoryButton('all', 'All components'),
      ...categories.map(group => this.categoryButton(group.id, group.title)),
      new Expanded(new SizedBox()), new Text('MATERIAL 3', {fontSize: 11, color: colors.primary}),
    ], {crossAlign: 'start', spacing: 6})), colors.surfaceContainerLow);
  }
  private group(context: BuildContext, demo: ComponentDemo, first: boolean): Widget {
    const category = categories.find(group => group.id === demo.category)!, colors = Theme.of(context).colorScheme;
    return new Padding(EdgeInsets.only({bottom: 20}), new Card({
      margin: EdgeInsets.zero, elevation: 0, color: new Color(colors.surfaceContainerLow),
      child: inset(20, column(
        ...(first ? [
          new Row([icon(categoryIcons[demo.category], colors.primary), new Expanded(new Text(category.title, {fontSize: 21}))], {spacing: 10, crossAlign: 'center'}),
          new Text(category.description, {fontSize: 12, color: colors.onSurfaceVariant}),
        ] : []),
        this.section(context, demo),
      )),
    }));
  }
  private section(context: BuildContext, demo: ComponentDemo): Widget {
    const colors = Theme.of(context).colorScheme;
    return new Padding(EdgeInsets.only({top: 18}), column(
      new Divider(),
      new Row([
        new Expanded(new Text(demo.title, {fontSize: 15, color: colors.onSurface})),
        ...(demo.status === 'basic' ? [new Text('기본 API', {fontSize: 10, color: colors.onSurfaceVariant})] : []),
      ], {crossAlign: 'center'}),
      demo.status === 'planned' ? column(
        new Text('준비 중', {fontSize: 13, color: colors.primary}),
        new Text('이 컴포넌트의 데모는 아직 제공되지 않습니다.', {fontSize: 12, color: colors.onSurfaceVariant}),
      ) : this.demo(context, demo.id),
    ));
  }
  private demo(context: BuildContext, id: string): Widget {
    const update=(change:()=>void)=>this.updates.change(id,change);
    const colors = Theme.of(context).colorScheme;
    switch (id) {
      case 'buttons': {
        const press = (name: string) => () => this.record(name + ' pressed');
        return column(flow(
          new ElevatedButton({id: 'demo-elevated', child: new Text('Elevated'), onPressed: press('Elevated')}),
          new FilledButton({id: 'demo-filled', child: new Text('Filled'), onPressed: press('Filled')}),
          FilledButton.tonal({id: 'demo-tonal', child: new Text('Tonal'), onPressed: press('Tonal')}),
          new OutlinedButton({id: 'demo-outlined', child: new Text('Outlined'), onPressed: press('Outlined')}),
          new TextButton({id: 'demo-text', child: new Text('Text'), onPressed: press('Text')}),
        ), flow(
          FilledButton.icon({id: 'demo-icon-filled', icon: icon(Icons.add), label: new Text('Create'), onPressed: press('Create')}),
          new FilledButton({id: 'demo-disabled', child: new Text('Disabled'), onPressed: null}),
        ));
      }
      case 'icon-buttons': {
        const options = {icon: icon(Icons.favorite_border), selectedIcon: icon(Icons.favorite), isSelected: this.favorite, onPressed: () => update(() => {this.favorite = !this.favorite;})};
        return flow(new IconButton({...options, id: 'favorite-standard', tooltip: 'Favorite'}),
          IconButton.filled({...options, id: 'favorite-filled', tooltip: 'Filled favorite'}),
          IconButton.filledTonal({...options, id: 'favorite-tonal', tooltip: 'Tonal favorite'}),
          IconButton.outlined({...options, id: 'favorite-outlined', tooltip: 'Outlined favorite'}));
      }
      case 'badges': return flow(
        Badge.count({count: this.messages, child: new IconButton({id: 'badge-mail', icon: icon(Icons.mail_outline), tooltip: 'Add message', onPressed: () => update(() => {this.messages++;})})}),
        Badge.count({count: 9999, child: icon(Icons.notifications_none)}),
        new Badge({child: icon(Icons.mail_outline)}), new Text(this.messages + ' messages', {fontSize: 12}),
      );
      case 'progress': return column(
        new Row([new RepaintBoundary(new CircularProgressIndicator({value: this.progress ? null : .65})), new SizedBox(20),
          new Expanded(new RepaintBoundary(new LinearProgressIndicator({value: this.progress ? null : .65})))], {crossAlign: 'center'}),
        new TextButton({id: 'toggle-progress', child: new Text(this.progress ? 'Stop animation' : 'Animate progress'), onPressed: () => update(() => {this.progress = !this.progress;})}),
      );
      case 'cards': {
        const content = (label: string): Widget => inset(16, column(icon(Icons.landscape, colors.primary, 28), new Text(label, {fontSize: 13}), new Text('Build something beautiful.', {fontSize: 11, color: colors.onSurfaceVariant})));
        return column(new Card({margin: EdgeInsets.zero, child: content('Elevated card')}),
          Card.filled({margin: EdgeInsets.zero, child: content('Filled card')}),
          Card.outlined({margin: EdgeInsets.zero, child: content('Outlined card')}));
      }
      case 'dialog': return new OutlinedButton({id: 'open-dialog', child: new Text('Open basic dialog'), onPressed: () => this.openDialog()});
      case 'dividers': return column(new Text('Above', {fontSize: 12}), new Divider(), new Text('Below', {fontSize: 12}));
      case 'checkboxes': return flow(
        new Checkbox({id: 'check-value', value: this.checked, onChanged: value => update(() => {this.checked = value;})}),
        new Text(this.checked ? 'Checked' : 'Unchecked', {fontSize: 12}),
        new Checkbox({id: 'check-mixed', value: this.mixed, tristate: true, onChanged: value => update(() => {this.mixed = value;})}),
        new Checkbox({id: 'check-disabled', value: true, onChanged: null}),
      );
      case 'chips': return column(
        flow(...['Day', 'Week', 'Month'].map(label => new ChoiceChip({label: new Text(label), selected: this.chip === label, onSelected: () => update(() => {this.chip = label;})}))),
        flow(new FilterChip({label: new Text('Filter'), selected: this.filtered, onSelected: value => update(() => {this.filtered = value;})}),
          new ActionChip({avatar: icon(Icons.add, colors.primary, 18), label: new Text('Add item'), onPressed: () => this.record('Chip added an item')})),
      );
      case 'radios': return new RadioGroup<string>({
        typeToken: this.radioToken, groupValue: this.selectedRadio, onChanged: value => update(() => {if (value !== null) this.selectedRadio = value;}),
        child: flow(...['first', 'second', 'third'].map((value, index) => new Row([
          new Radio({id: 'radio-' + value, value, groupToken: this.radioToken}), new Text(['First', 'Second', 'Third'][index]!, {fontSize: 12}),
        ], {mainSize: 'min', crossAlign: 'center'}))),
      });
      case 'sliders': return column(
        new Slider({id: 'slider-value', value: this.slider, min: 0, max: 100, divisions: 10, label: String(this.slider), onChanged: value => update(() => {this.slider = value;})}),
        new Text('Value ' + Math.round(this.slider), {fontSize: 12}),
        new RangeSlider({id: 'range-value', values: this.range, min: 0, max: 100, divisions: 10, onChanged: values => update(() => {this.range = values;})}),
        new Text('Range ' + Math.round(this.range.start) + ' – ' + Math.round(this.range.end), {fontSize: 12}),
      );
      case 'switches': return flow(
        new Switch({id: 'switch-value', value: this.switched, onChanged: value => update(() => {this.switched = value;})}),
        new Text(this.switched ? 'On' : 'Off', {fontSize: 12}), new Switch({id: 'switch-disabled', value: true, onChanged: null}),
      );
      case 'text-fields': return column(
        new TextField({id:'field-filled',controller:this.filled,maxLength:20,enableInteractiveSelection:this.interactiveMessage,obscureText:this.obscureMessage,decoration:new InputDecoration({filled:true,labelText:'Write something',hintText:'Korean · emoji · 20 graphemes',helperText:'조합 입력은 확정 후 길이를 제한합니다.'}),onSubmitted:text=>this.record('Submitted: '+text)}),
        new TextField({id:'field-outlined',controller:this.outlined,scrollController:this.messageScroll,enableInteractiveSelection:this.interactiveMessage,minLines:this.multilineMessage?2:null,maxLines:this.multilineMessage?4:1,decoration:new InputDecoration({labelText:'Your message',border:new OutlineInputBorder(),helperText:this.multilineMessage?'Enter로 줄바꿈 · Ctrl+Enter로 제출':'Enter로 제출',errorText:this.outlined.text.length===0?'메시지를 입력하세요.':null}),onChanged:()=>update(()=>{}),onSubmitted:()=>this.record('Message submitted')}),
        new TextFieldTapRegion(flow(new TextButton({id:'toggle-secure-input',child:new Text(this.obscureMessage?'Show input':'Secure input'),onPressed:()=>update(()=>{this.obscureMessage=!this.obscureMessage;})}),new TextButton({child:new Text('Clear messages'),onPressed:()=>{if(!this.filled.isComposing&&!this.outlined.isComposing){this.filled.clear();this.outlined.clear();update(()=>{});}}}),new TextButton({child:new Text('Undo message'),onPressed:()=>{this.outlined.undo();update(()=>{});}}))),
        new TextFieldTapRegion(flow(new TextButton({id:'toggle-message-lines',child:new Text(this.multilineMessage?'Use one line':'Use multiple lines'),onPressed:()=>update(()=>{this.multilineMessage=!this.multilineMessage;})}),new TextButton({id:'toggle-message-selection',child:new Text(this.interactiveMessage?'Disable selection':'Enable selection'),onPressed:()=>update(()=>{this.interactiveMessage=!this.interactiveMessage;})}))),
        new TextFieldTapRegion(flow(...[false,true].map(end=>new TextButton({id:end?'message-scroll-end':'message-scroll-top',child:new Text(end?'Scroll to end':'Scroll to top'),onPressed:()=>{if(this.messageScroll.hasClients&&this.messageScroll.position.hasContentDimensions){this.messageScroll.jumpTo(end?this.messageScroll.position.maxScrollExtent:0);this.record(end?'Message scroll end':'Message scroll top');}}})))),
        new MaterialFormDemo(),
      );
      case 'image': return column(
        new Center(Image.asset('component-image', {
          width: 360, height: 220, cacheWidth: 720, fit: this.imageCover ? 'cover' : 'contain',
          semanticLabel: 'Oranges by Mae Mu', errorBuilder: () => new Text('이미지를 불러오지 못했습니다.'),
        })),
        flow(...[true, false].map(cover => new ChoiceChip({label: new Text(cover ? 'Cover' : 'Contain'), selected: this.imageCover === cover, onSelected: () => update(() => {this.imageCover = cover;})}))),
        new Text('Photo by Mae Mu · Unsplash', {fontSize: 11, color: colors.onSurfaceVariant}),
      );
      default: throw new Error('No implemented demo for ' + id);
    }
  }
}

class MaterialFormDemo extends StatefulWidget {
  createState():State<MaterialFormDemo>{return new MaterialFormDemoState();}
}
class MaterialFormDemoState extends State<MaterialFormDemo> {
  private readonly formKey=new GlobalKey<FormState>('Material input form');
  private savedName='';private savedEmail='';private status='이름과 이메일을 입력한 뒤 저장하세요.';
  private save=()=>{const form=this.formKey.currentState;if(!form)return;const valid=form.validate();if(valid)form.save();this.setState(()=>{this.status=valid?`Saved: ${this.savedName} · ${this.savedEmail}`:'필수 항목과 이메일 형식을 확인하세요.';});};
  build():Widget{return new Form({key:this.formKey,autovalidateMode:'onUserInteraction',child:column(
    new Text('Form validation · reset', {fontSize:15}),
    new TextFormField({id:'form-name',decoration:new InputDecoration({labelText:'Name',border:new OutlineInputBorder()}),autofillHints:['name'],textInputAction:'next',validator:value=>value.trim()?null:'이름을 입력하세요.',onSaved:value=>{this.savedName=value;}}),
    new TextFormField({id:'form-email',decoration:new InputDecoration({labelText:'Email',border:new OutlineInputBorder()}),keyboardType:'email',autofillHints:['email'],textInputAction:'done',validator:value=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)?null:'이메일 형식을 확인하세요.',onSaved:value=>{this.savedEmail=value;},onSubmitted:this.save}),
    flow(new FilledButton({id:'form-save',child:new Text('Save form'),onPressed:this.save}),new OutlinedButton({id:'form-reset',child:new Text('Reset form'),onPressed:()=>{this.formKey.currentState?.reset();this.setState(()=>{this.status='Form reset';});}})),
    new Text(this.status,{fontSize:12}),
  )});}
}

/** Finish replacing a design App only after its descendant resources retire. */
class DesignSession extends StatefulWidget {
  constructor(readonly child: Widget, readonly onRetired: () => void) {super();}
  createState(): State<DesignSession> {return new DesignSessionState();}
}
class DesignSessionState extends State<DesignSession> {
  build(): Widget {return this.widget.child;}
  override dispose(): void {this.widget.onRetired(); super.dispose();}
}
