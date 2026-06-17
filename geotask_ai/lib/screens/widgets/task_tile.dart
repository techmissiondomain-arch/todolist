import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/enums.dart';
import '../../models/task.dart';

/// One row in the task list. Shows the title, a location/time chip, and a
/// checkbox to complete it.
class TaskTile extends StatelessWidget {
  final Task task;
  final VoidCallback onToggle;
  final VoidCallback onTap;

  const TaskTile({
    super.key,
    required this.task,
    required this.onToggle,
    required this.onTap,
  });

  IconData get _triggerIcon => switch (task.triggerType) {
        TriggerType.arrive => Icons.login,
        TriggerType.leave => Icons.logout,
        TriggerType.nearby => Icons.near_me_outlined,
        TriggerType.none => Icons.schedule,
      };

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final done = task.isDone;

    String? subtitle;
    if (task.triggerType.isLocationBased) {
      subtitle = '${task.triggerType.label} · ${task.locationName ?? 'a place'}';
    } else if (task.dueDate != null) {
      subtitle = DateFormat('EEE, MMM d · h:mm a').format(task.dueDate!);
    }

    return Card(
      child: ListTile(
        onTap: onTap,
        leading: IconButton(
          icon: Icon(done ? Icons.check_circle : Icons.circle_outlined,
              color: done ? scheme.primary : scheme.outline),
          onPressed: onToggle,
        ),
        title: Text(
          task.title,
          style: TextStyle(
            decoration: done ? TextDecoration.lineThrough : null,
            color: done ? scheme.outline : null,
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: subtitle == null
            ? null
            : Row(
                children: [
                  Icon(_triggerIcon, size: 14, color: scheme.primary),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(subtitle,
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                ],
              ),
        trailing: _PriorityDot(priority: task.priority),
      ),
    );
  }
}

class _PriorityDot extends StatelessWidget {
  final TaskPriority priority;
  const _PriorityDot({required this.priority});

  @override
  Widget build(BuildContext context) {
    final color = switch (priority) {
      TaskPriority.high => Colors.red,
      TaskPriority.medium => Colors.orange,
      TaskPriority.low => Colors.green,
    };
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}
