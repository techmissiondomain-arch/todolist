import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/enums.dart';
import '../../models/task.dart';
import '../../providers/task_provider.dart';

/// Read + light-edit view for a single task. Lets the user complete, reopen,
/// edit the title/priority, or delete.
class TaskDetailScreen extends StatefulWidget {
  final Task task;
  const TaskDetailScreen({super.key, required this.task});

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  late TextEditingController _title;
  late TextEditingController _desc;
  late TaskPriority _priority;

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(text: widget.task.title);
    _desc = TextEditingController(text: widget.task.description ?? '');
    _priority = widget.task.priority;
  }

  Future<void> _saveEdits() async {
    final updated = widget.task.copyWith(
      title: _title.text.trim(),
      description: _desc.text.trim(),
      priority: _priority,
    );
    await context.read<TaskProvider>().save(updated);
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Saved ✓')));
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete task?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (ok == true && mounted) {
      await context.read<TaskProvider>().remove(widget.task.id);
      if (mounted) Navigator.pop(context);
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _desc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.task;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Task'),
        actions: [
          IconButton(
              icon: const Icon(Icons.delete_outline), onPressed: _delete),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextField(
            controller: _title,
            decoration: const InputDecoration(labelText: 'Title'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _desc,
            minLines: 2,
            maxLines: 5,
            decoration: const InputDecoration(labelText: 'Notes'),
          ),
          const SizedBox(height: 16),
          Text('Priority', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: TaskPriority.values
                .map((p) => ChoiceChip(
                      label: Text(p.name),
                      selected: _priority == p,
                      onSelected: (_) => setState(() => _priority = p),
                    ))
                .toList(),
          ),
          const SizedBox(height: 20),
          if (t.triggerType.isLocationBased) _infoCard(
            icon: Icons.place,
            title: t.triggerType.label,
            value: '${t.locationName ?? 'A place'} · ${t.radiusMeters}m radius',
          ),
          if (t.dueDate != null)
            _infoCard(
              icon: Icons.schedule,
              title: 'Time reminder',
              value: DateFormat('EEE, MMM d · h:mm a').format(t.dueDate!),
            ),
          if (t.lastTriggeredAt != null)
            _infoCard(
              icon: Icons.notifications_active_outlined,
              title: 'Last reminded',
              value: DateFormat('MMM d · h:mm a').format(t.lastTriggeredAt!),
            ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: _saveEdits,
            icon: const Icon(Icons.save_outlined),
            label: const Text('Save changes'),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () {
              final provider = context.read<TaskProvider>();
              t.status == TaskStatus.done
                  ? provider.reopen(t.id)
                  : provider.complete(t.id);
              Navigator.pop(context);
            },
            icon: Icon(t.status == TaskStatus.done
                ? Icons.undo
                : Icons.check_circle_outline),
            label: Text(t.status == TaskStatus.done
                ? 'Mark as not done'
                : 'Mark as done'),
          ),
        ],
      ),
    );
  }

  Widget _infoCard(
          {required IconData icon,
          required String title,
          required String value}) =>
      Card(
        child: ListTile(
          leading: Icon(icon),
          title: Text(title),
          subtitle: Text(value),
        ),
      );
}
