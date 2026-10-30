// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Traversal intents/actions from widgets/focus_traversal.dart. Policies, groups
// and orders use their own direct modules to avoid widget/policy import cycles.
import { Intent, Action, ContextAction } from './actions.ts';
import { Element } from './framework.ts';
import type { BuildContext } from './framework.ts';
import type { FocusNode, KeyEventResult } from './focus.ts';
import type { TraversalDirection } from './focus-traversal-policy.ts';

export class RequestFocusIntent extends Intent {
  constructor(
    readonly focusNode: FocusNode,
    readonly requestFocusCallback: (node: FocusNode) => void = (node) => {
      node.requestFocus();
      node.showOnScreen();
    },
  ) {
    super();
  }
}
export class RequestFocusAction extends Action<RequestFocusIntent> {
  constructor() {
    super(RequestFocusIntent);
  }
  invoke(intent: RequestFocusIntent): null {
    intent.requestFocusCallback(intent.focusNode);
    return null;
  }
}
export class NextFocusIntent extends Intent {}
export class PreviousFocusIntent extends Intent {}
export class NextFocusAction extends ContextAction<NextFocusIntent> {
  constructor() {
    super(NextFocusIntent);
  }
  invoke(_intent: NextFocusIntent, context?: BuildContext): boolean {
    return context instanceof Element
      ? (context.owner.focus.primaryFocus ?? context.owner.focus.rootScope).nextFocus()
      : false;
  }
  override toKeyEventResult(_intent: NextFocusIntent, result: unknown): KeyEventResult {
    return result === true ? 'handled' : 'skipRemainingHandlers';
  }
}
export class PreviousFocusAction extends ContextAction<PreviousFocusIntent> {
  constructor() {
    super(PreviousFocusIntent);
  }
  invoke(_intent: PreviousFocusIntent, context?: BuildContext): boolean {
    return context instanceof Element
      ? (context.owner.focus.primaryFocus ?? context.owner.focus.rootScope).previousFocus()
      : false;
  }
  override toKeyEventResult(_intent: PreviousFocusIntent, result: unknown): KeyEventResult {
    return result === true ? 'handled' : 'skipRemainingHandlers';
  }
}
export class DirectionalFocusIntent extends Intent {
  readonly ignoreTextFields: boolean;
  constructor(
    readonly direction: TraversalDirection,
    { ignoreTextFields = true }: { readonly ignoreTextFields?: boolean } = {},
  ) {
    super();
    this.ignoreTextFields = ignoreTextFields;
  }
}
const textFieldDirectionalActions = new WeakSet<DirectionalFocusAction>();
export class DirectionalFocusAction extends ContextAction<DirectionalFocusIntent> {
  constructor() {
    super(DirectionalFocusIntent);
  }
  static forTextField(): DirectionalFocusAction {
    const action = new DirectionalFocusAction();
    textFieldDirectionalActions.add(action);
    return action;
  }
  invoke(intent: DirectionalFocusIntent, context?: BuildContext): null {
    if (
      (!intent.ignoreTextFields || !textFieldDirectionalActions.has(this)) &&
      context instanceof Element
    )
      context.owner.focus.primaryFocus?.focusInDirection(intent.direction);
    return null;
  }
}
