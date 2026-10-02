import { InputRule } from "@tiptap/core";
import { TaskItem } from "@tiptap/extension-list";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { canJoin } from "@tiptap/pm/transform";

// `- `, `* `, and `+ ` already become a bullet list. This recognizes the
// checklist marker typed next, which is the Obsidian `- [ ] ` sequence.
const bulletTaskMarker = /^\s*\[([ xX])\] $/;

const convertBulletItemMarkedAsTask: InputRule["handler"] = ({ state, range, match }) => {
  const checked = match[1]?.toLowerCase() === "x";
  const $before = state.doc.resolve(range.from);
  if ($before.parent.type.name !== "paragraph" || $before.depth < 2) return null;
  if ($before.node(-1).type.name !== "listItem" || $before.node(-2).type.name !== "bulletList") {
    return null;
  }

  const taskItemType = state.schema.nodes.taskItem;
  const taskListType = state.schema.nodes.taskList;
  if (!taskItemType || !taskListType) return null;

  const tr = state.tr.delete(range.from, range.to);
  const $pos = tr.doc.resolve(range.from);
  if ($pos.parent.type.name !== "paragraph" || $pos.depth < 2) return null;

  const listItem = $pos.node(-1);
  const bulletList = $pos.node(-2);
  if (listItem.type.name !== "listItem" || bulletList.type.name !== "bulletList") return null;

  const bulletDepth = $pos.depth - 2;
  const itemIndex = $pos.index(bulletDepth);
  const taskItem = taskItemType.create({ checked }, listItem.content);
  const taskList = taskListType.create(null, taskItem);
  const before: ProseMirrorNode[] = [];
  const after: ProseMirrorNode[] = [];

  bulletList.forEach((child, _offset, index) => {
    if (index < itemIndex) before.push(child);
    else if (index > itemIndex) after.push(child);
  });

  const replacement = [
    ...(before.length ? [bulletList.type.create(bulletList.attrs, before)] : []),
    taskList,
    ...(after.length ? [bulletList.type.create(bulletList.attrs, after)] : []),
  ];
  const bulletStart = $pos.before(bulletDepth);
  tr.replaceWith(bulletStart, $pos.after(bulletDepth), replacement);

  // bulletStart is the left edge of the replacement, so it still addresses the
  // new nodes. Mapping it would treat that intermediate position as original.
  let taskListPos = bulletStart;
  if (before.length) taskListPos += replacement[0]?.nodeSize ?? 0;
  const caret = taskListPos + 3;
  const mapFrom = tr.steps.length;
  const joinTaskListsAt = (pos: number) => {
    if (pos <= 0 || pos >= tr.doc.content.size) return;
    const $join = tr.doc.resolve(pos);
    if ($join.nodeBefore?.type !== taskListType || $join.nodeAfter?.type !== taskListType) return;
    if (canJoin(tr.doc, pos)) tr.join(pos);
  };
  joinTaskListsAt(taskListPos + taskList.nodeSize);
  joinTaskListsAt(taskListPos);

  tr.setSelection(TextSelection.create(tr.doc, tr.mapping.slice(mapFrom).map(caret)));
};

export const createEdgeEverTaskItem = () => TaskItem.extend({
  addInputRules() {
    return [
      new InputRule({
        find: bulletTaskMarker,
        handler: convertBulletItemMarkedAsTask,
      }),
      ...(this.parent?.() ?? []),
    ];
  },
}).configure({ nested: true });
