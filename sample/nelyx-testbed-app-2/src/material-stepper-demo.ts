// SPDX-License-Identifier: BSD-3-Clause
import { Row, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import { FilledButton } from '@nelyx/material/filled-button';
import { TextButton } from '@nelyx/material/text-button';
import { Step, Stepper, StepState } from '@nelyx/material/stepper';

const labels = ['Account step', 'Unavailable step', 'Review step'];

export class MaterialStepperDemo extends StatefulWidget {
  constructor(readonly record: (message: string) => void) {
    super();
  }
  createState(): State<MaterialStepperDemo> {
    return new MaterialStepperDemoState();
  }
}

class MaterialStepperDemoState extends State<MaterialStepperDemo> {
  private current = 0;
  private select(index: number): void {
    this.setState(() => {
      this.current = index;
    });
    this.widget.record(`Stepper: ${labels[index]}`);
  }
  override build(): Widget {
    return new SizedBox(
      undefined,
      360,
      new Stepper({
        currentStep: this.current,
        onStepTapped: (index) => this.select(index),
        onStepContinue: this.current === 0 ? () => this.select(2) : null,
        onStepCancel: this.current === 2 ? () => this.select(0) : null,
        controlsBuilder: (_context, details) =>
          new Row([
            new FilledButton({
              child: new Text('Continue step'),
              onPressed: details.onStepContinue,
            }),
            new TextButton({ child: new Text('Back a step'), onPressed: details.onStepCancel }),
          ]),
        steps: labels.map(
          (label, index) =>
            new Step({
              title: new Text(label),
              content: new Text(`${label} details`),
              isActive: this.current === index,
              state:
                index === 1
                  ? StepState.disabled
                  : this.current > index
                    ? StepState.complete
                    : StepState.indexed,
            }),
        ),
      }),
    );
  }
}
