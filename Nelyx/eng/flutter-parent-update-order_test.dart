import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

class Branch extends StatefulWidget {
  const Branch(this.name, this.events);
  final String name;
  final List<String> events;

  @override
  State<Branch> createState() => BranchState();
}

class BranchState extends State<Branch> {
  void record(String phase) => widget.events.add('${widget.name}.$phase');
  void invalidate() => setState(() {});

  @override
  void initState() {
    super.initState();
    record('init');
  }

  @override
  void didUpdateWidget(Branch oldWidget) {
    super.didUpdateWidget(oldWidget);
    record('update');
  }

  @override
  Widget build(BuildContext context) {
    record('build');
    return Builder(
      builder: (_) {
        record('child');
        return const SizedBox();
      },
    );
  }
}

void main() {
  testWidgets(
    'parent delivers each configuration through its descendants before the next sibling',
    (tester) async {
      final events = <String>[];
      Widget branches() => Row(
        textDirection: TextDirection.ltr,
        children: [Branch('A', events), Branch('B', events)],
      );
      await tester.pumpWidget(branches());
      expect(events, [
        'A.init',
        'A.build',
        'A.child',
        'B.init',
        'B.build',
        'B.child',
      ]);
      events.clear();
      final first = find.byType(Branch).first;
      final state = tester.state<BranchState>(first)..invalidate();
      await tester.pumpWidget(branches());
      expect(tester.state<BranchState>(first), same(state));
      expect(events, [
        'A.update',
        'A.build',
        'A.child',
        'B.update',
        'B.build',
        'B.child',
      ]);
      events.clear();
      state.invalidate();
      await tester.pumpWidget(
        Row(
          textDirection: TextDirection.ltr,
          children: tester.widgetList<Branch>(find.byType(Branch)).toList(),
        ),
      );
      expect(events, ['A.build', 'A.child']);
    },
  );
}
