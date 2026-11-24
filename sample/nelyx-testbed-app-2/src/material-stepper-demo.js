// SPDX-License-Identifier: BSD-3-Clause
import { Row, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { FilledButton } from '@nelyx/material/filled-button';
import { TextButton } from '@nelyx/material/text-button';
import { Step, Stepper, StepState } from '@nelyx/material/stepper';
const labels = ['Account step', 'Unavailable step', 'Review step'];
export class MaterialStepperDemo extends StatefulWidget {
    record;
    constructor(record) {
        super();
        this.record = record;
    }
    createState() {
        return new MaterialStepperDemoState();
    }
}
class MaterialStepperDemoState extends State {
    current = 0;
    select(index) {
        this.setState(() => {
            this.current = index;
        });
        this.widget.record(`Stepper: ${labels[index]}`);
    }
    build() {
        return new SizedBox(undefined, 360, new Stepper({
            currentStep: this.current,
            onStepTapped: (index) => this.select(index),
            onStepContinue: this.current === 0 ? () => this.select(2) : null,
            onStepCancel: this.current === 2 ? () => this.select(0) : null,
            controlsBuilder: (_context, details) => new Row([
                new FilledButton({
                    child: new Text('Continue step'),
                    onPressed: details.onStepContinue,
                }),
                new TextButton({ child: new Text('Back a step'), onPressed: details.onStepCancel }),
            ]),
            steps: labels.map((label, index) => new Step({
                title: new Text(label),
                content: new Text(`${label} details`),
                isActive: this.current === index,
                state: index === 1
                    ? StepState.disabled
                    : this.current > index
                        ? StepState.complete
                        : StepState.indexed,
            })),
        }));
    }
}
