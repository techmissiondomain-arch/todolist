import 'package:flutter/material.dart';

import '../../models/parsed_task.dart';
import '../../services/ai_service.dart';
import '../confirm/task_confirmation_screen.dart';

/// Where the user types a natural-language reminder. The AI parses it and we
/// move to the confirmation screen to verify the place/time.
class AddTaskScreen extends StatefulWidget {
  const AddTaskScreen({super.key});

  @override
  State<AddTaskScreen> createState() => _AddTaskScreenState();
}

class _AddTaskScreenState extends State<AddTaskScreen> {
  final _input = TextEditingController();
  final _ai = AiService();
  bool _busy = false;
  String? _error;

  static const _examples = [
    'Remind me to buy milk when I arrive at Carrefour.',
    'Mail this package when I leave home.',
    'Pick up medicine when I’m near the pharmacy.',
    'Call Sarah tomorrow at 10.',
  ];

  Future<void> _parse() async {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final ParsedTask parsed = await _ai.parse(text);
      if (!mounted) return;
      // Move to confirmation, replacing this screen.
      Navigator.of(context).pushReplacement(MaterialPageRoute(
        builder: (_) => TaskConfirmationScreen(parsed: parsed, original: text),
      ));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Add task')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Describe your reminder',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          const Text(
              'Type naturally — mention a place and whether it’s on arrive, '
              'leave, or nearby. AI fills in the rest.'),
          const SizedBox(height: 16),
          TextField(
            controller: _input,
            minLines: 3,
            maxLines: 6,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'e.g. Remind me to buy milk when I arrive at Carrefour.',
            ),
          ),
          const SizedBox(height: 12),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(_error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          FilledButton.icon(
            onPressed: _busy ? null : _parse,
            icon: _busy
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.auto_awesome),
            label: Text(_busy ? 'Thinking…' : 'Create with AI'),
          ),
          const SizedBox(height: 28),
          Text('Try one of these',
              style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          ..._examples.map((e) => Card(
                child: ListTile(
                  leading: const Icon(Icons.bolt_outlined),
                  title: Text(e),
                  onTap: () => _input.text = e,
                ),
              )),
        ],
      ),
    );
  }
}
