"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { moveTodo } from "@/app/(app)/projects/actions";

export interface KanbanTodo {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  sortOrder: number;
  endDate: string | null;
  assignee: { id: string; name: string } | null;
  milestone: { id: string; title: string } | null;
  prerequisites: { dependsOn: { id: string; title: string; status: string } }[];
}

const COLUMNS: { id: KanbanTodo["status"]; label: string }[] = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
];

function isOverdue(t: KanbanTodo): boolean {
  if (!t.endDate || t.status === "DONE") return false;
  return t.endDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

function TodoCard({ todo, onClick }: { todo: KanbanTodo; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const blockers = todo.prerequisites.filter((p) => p.dependsOn.status !== "DONE");
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-indigo-300 active:cursor-grabbing"
    >
      <p className="text-sm font-medium text-slate-900">{todo.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {todo.milestone && (
          <Badge color="info" className="text-[10px]">{todo.milestone.title}</Badge>
        )}
        {blockers.length > 0 && todo.status !== "DONE" && (
          <Badge color="warning" className="text-[10px]" title={`Waiting on: ${blockers.map((b) => b.dependsOn.title).join(", ")}`}>
            Blocked by {blockers.length}
          </Badge>
        )}
        {todo.prerequisites.length > 0 && blockers.length === 0 && (
          <Badge color="success" className="text-[10px]">Deps met</Badge>
        )}
        {todo.endDate && (
          <Badge color={isOverdue(todo) ? "danger" : "default"} className="text-[10px]">
            {isOverdue(todo) ? "Overdue " : ""}{todo.endDate.slice(0, 10)}
          </Badge>
        )}
        {todo.assignee && (
          <span className="ml-auto"><Avatar name={todo.assignee.name} className="h-6 w-6 text-[10px]" /></span>
        )}
      </div>
    </div>
  );
}

function Column({
  id,
  label,
  todos,
  onTodoClick,
}: {
  id: KanbanTodo["status"];
  label: string;
  todos: KanbanTodo[];
  onTodoClick: (t: KanbanTodo) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${id}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-80 shrink-0 flex-col rounded-xl border p-2 ${isOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}
    >
      <div className="flex items-center justify-between px-2 py-1.5">
        <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">{todos.length}</span>
      </div>
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[120px] flex-col gap-2">
          {todos.map((t) => (
            <TodoCard key={t.id} todo={t} onClick={() => onTodoClick(t)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({
  initialTodos,
  onTodoClick,
  onNewTodo,
}: {
  projectId: string;
  initialTodos: KanbanTodo[];
  onTodoClick: (t: KanbanTodo) => void;
  onNewTodo: (status: KanbanTodo["status"]) => void;
}) {
  const [todos, setTodos] = React.useState(initialTodos);
  const [activeTodo, setActiveTodo] = React.useState<KanbanTodo | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Sync when the server data refreshes (e.g. after a dialog save).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional prop-to-state sync on refresh
  React.useEffect(() => setTodos(initialTodos), [initialTodos]);

  const byStatus = React.useCallback(
    (status: KanbanTodo["status"]) =>
      todos.filter((t) => t.status === status).sort((a, b) => a.sortOrder - b.sortOrder),
    [todos]
  );

  function onDragStart(e: DragStartEvent) {
    const t = todos.find((x) => x.id === e.active.id);
    setActiveTodo(t ?? null);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveTodo(null);
    const { active, over } = e;
    if (!over) return;
    const dragged = todos.find((t) => t.id === active.id);
    if (!dragged) return;

    let toStatus = dragged.status;
    let toIndex = dragged.sortOrder;
    const overId = String(over.id);

    if (overId.startsWith("column-")) {
      toStatus = overId.replace("column-", "") as KanbanTodo["status"];
      toIndex = byStatus(toStatus).length;
    } else {
      const overTodo = todos.find((t) => t.id === overId);
      if (overTodo) {
        toStatus = overTodo.status;
        const col = byStatus(toStatus).filter((t) => t.id !== dragged.id);
        const overIdx = col.findIndex((t) => t.id === overTodo.id);
        toIndex = overIdx === -1 ? col.length : overIdx;
      }
    }

    if (toStatus === dragged.status && toIndex === dragged.sortOrder) return;

    // optimistic update
    setTodos((prev) => {
      const next = prev.filter((t) => t.id !== dragged.id);
      const moved = { ...dragged, status: toStatus };
      // reindex old column
      const oldCol = next.filter((t) => t.status === dragged.status).sort((a, b) => a.sortOrder - b.sortOrder);
      oldCol.forEach((t, i) => (t.sortOrder = i));
      // insert into new column
      const newCol = next.filter((t) => t.status === toStatus).sort((a, b) => a.sortOrder - b.sortOrder);
      newCol.splice(Math.min(toIndex, newCol.length), 0, moved);
      newCol.forEach((t, i) => (t.sortOrder = i));
      return next.map((t) => {
        const oc = oldCol.find((x) => x.id === t.id);
        if (oc) return oc;
        const nc = newCol.find((x) => x.id === t.id);
        if (nc) return nc;
        return t;
      });
    });

    const res = await moveTodo(dragged.id, toStatus, toIndex);
    if (!res.ok) {
      alert(res.error);
      setTodos(initialTodos);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => onNewTodo("TODO")}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Add todo
        </button>
      </div>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 scroll-thin">
          {COLUMNS.map((c) => (
            <Column key={c.id} id={c.id} label={c.label} todos={byStatus(c.id)} onTodoClick={onTodoClick} />
          ))}
        </div>
        <DragOverlay>
          {activeTodo && (
            <div className="w-80 rounded-lg border border-indigo-300 bg-white p-3 shadow-lg">
              <p className="text-sm font-medium text-slate-900">{activeTodo.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export { arrayMove };
