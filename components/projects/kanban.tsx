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
import { Avatar } from "@/components/ui/misc";
import { fmtDayMonth } from "@/lib/dates";
import { moveTodo, initKanbanOrder, deleteTodo } from "@/app/(app)/projects/actions";
import { GripVertical, Calendar, Trash2 } from "lucide-react";

export type TodoPriority = "LOW" | "MEDIUM" | "HIGH";

export interface KanbanTodo {
  id: string;
  title: string;
  description?: string | null;
  priority?: TodoPriority;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
  assignee: { id: string; name: string } | null;
  milestone: { id: string; title: string } | null;
  prerequisites: { dependsOn: { id: string; title: string; status: string } }[];
}

/** Reference-style priority pill: High solid red, Medium solid amber, Low grey. */
export function PriorityPill({ priority }: { priority: TodoPriority }) {
  const styles: Record<TodoPriority, string> = {
    HIGH: "bg-red-600 text-white",
    MEDIUM: "bg-amber-500 text-slate-900",
    LOW: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  };
  const labels: Record<TodoPriority, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
  return (
    <span className={`rounded-sm px-2 py-0.5 text-[11px] font-semibold ${styles[priority]}`}>{labels[priority]}</span>
  );
}

/** Earlier start date on top; undated todos sink to the bottom. */
function dateKey(t: KanbanTodo): string {
  return t.startDate ?? t.endDate ?? "9999-99-99";
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

/** The card's visual face — used by the sortable card and the drag overlay. */
function CardFace({
  todo,
  showPriority,
  onDelete,
}: {
  todo: KanbanTodo;
  showPriority?: boolean;
  onDelete?: (t: KanbanTodo) => void;
}) {
  const blockers = todo.prerequisites.filter((p) => p.dependsOn.status !== "DONE");
  const overdue = isOverdue(todo);
  return (
    <div className="rounded-sm border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {(todo.milestone || blockers.length > 0 || (todo.prerequisites.length > 0 && blockers.length === 0)) && (
        <div className="flex flex-wrap items-center gap-1.5 pr-5">
          {todo.milestone && (
            <span className="rounded-sm bg-accent-50 px-1.5 py-0.5 text-[10px] font-medium text-accent-700 dark:bg-accent-950 dark:text-accent-300">
              {todo.milestone.title}
            </span>
          )}
          {blockers.length > 0 && todo.status !== "DONE" && (
            <span
              className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              title={`Waiting on: ${blockers.map((b) => b.dependsOn.title).join(",")}`}
            >
              Blocked by {blockers.length}
            </span>
          )}
          {todo.prerequisites.length > 0 && blockers.length === 0 && (
            <span className="rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Deps met
            </span>
          )}
        </div>
      )}
      <p className="mt-1 line-clamp-2 pr-5 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{todo.title}</p>
      {todo.description && (
        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{todo.description}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        {showPriority && todo.priority && <PriorityPill priority={todo.priority} />}
        {todo.endDate && (
          <span
            className={`inline-flex items-center gap-1 text-xs ${overdue ? "font-semibold text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}
          >
            <Calendar className="h-3.5 w-3.5" />
            {overdue ? "Overdue · " : ""}{fmtDayMonth(todo.endDate.slice(0, 10))}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {onDelete && (
            <button
              type="button"
              title="Delete todo"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(todo);
              }}
              className="text-slate-300 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100 dark:text-slate-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {todo.assignee && <Avatar name={todo.assignee.name} className="h-6 w-6 text-[10px]" />}
        </span>
      </div>
    </div>
  );
}

function TodoCard({
  todo,
  showPriority,
  canDelete,
  onClick,
  onDelete,
}: {
  todo: KanbanTodo;
  showPriority?: boolean;
  canDelete?: boolean;
  onClick: () => void;
  onDelete: (t: KanbanTodo) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // The drag overlay is the visible card while dragging (reference-style);
    // the source slot stays empty as the other cards reflow around it.
    opacity: isDragging ? 0 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} onClick={onClick} className="group relative">
      <CardFace todo={todo} showPriority={showPriority} onDelete={canDelete ? onDelete : undefined} />
      {/* Dragging works ONLY from this grip (the card body opens the todo). */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        type="button"
        title="Drag to move"
        onClick={(e) => e.stopPropagation()}
        className="absolute right-2 top-2.5 cursor-grab text-slate-300 opacity-0 transition-opacity hover:text-slate-500 focus:opacity-100 group-hover:opacity-100 active:cursor-grabbing dark:text-slate-600 dark:hover:text-slate-400"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

function Column({
  id,
  label,
  todos,
  showPriority,
  canManage,
  onTodoClick,
  onDeleteTodo,
}: {
  id: KanbanTodo["status"];
  label: string;
  todos: KanbanTodo[];
  showPriority?: boolean;
  canManage?: boolean;
  onTodoClick: (t: KanbanTodo) => void;
  onDeleteTodo: (t: KanbanTodo) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${id}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-[300px] shrink-0 flex-col rounded-sm border p-3 transition-colors ${
        isOver
          ? "border-accent-400 bg-accent-50 ring-1 ring-accent-400 dark:bg-accent-950/40"
          : "border-slate-200/70 bg-slate-100/80 dark:border-slate-700/60 dark:bg-slate-800/50"
      }`}
    >
      <div className="flex items-center justify-between px-1 pb-2.5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 shadow-sm dark:bg-slate-700 dark:text-slate-300">
          {todos.length}
        </span>
      </div>
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[120px] flex-col gap-3">
          {todos.map((t) => (
            <TodoCard
              key={t.id}
              todo={t}
              showPriority={showPriority}
              canDelete={canManage}
              onClick={() => onTodoClick(t)}
              onDelete={onDeleteTodo}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({
  projectId,
  initialTodos,
  kanbanOrdered,
  showPriority,
  canManage,
  onTodoClick,
  onNewTodo,
}: {
  projectId: string;
  initialTodos: KanbanTodo[];
  kanbanOrdered: boolean;
  showPriority?: boolean;
  canManage?: boolean;
  onTodoClick: (t: KanbanTodo) => void;
  onNewTodo: (status: KanbanTodo["status"]) => void;
}) {
  const [todos, setTodos] = React.useState(initialTodos);
  const [activeTodo, setActiveTodo] = React.useState<KanbanTodo | null>(null);
  const [ordered, setOrdered] = React.useState(kanbanOrdered);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Sync when the server data refreshes (e.g. after a dialog save).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional prop-to-state sync on refresh
  React.useEffect(() => {
    setTodos(initialTodos);
    setOrdered(kanbanOrdered);
  }, [initialTodos, kanbanOrdered]);

  const byStatus = React.useCallback(
    (status: KanbanTodo["status"]) =>
      todos
        .filter((t) => t.status === status)
        .sort((a, b) => (ordered ? a.sortOrder - b.sortOrder : dateKey(a).localeCompare(dateKey(b)))),
    [todos, ordered]
  );

  function onDragStart(e: DragStartEvent) {
    const t = todos.find((x) => x.id === e.active.id);
    setActiveTodo(t ?? null);
  }

  async function handleDeleteTodo(t: KanbanTodo) {
    if (!confirm(`Delete todo "${t.title}"? This cannot be undone.`)) return;
    const res = await deleteTodo(t.id);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setTodos((prev) => prev.filter((x) => x.id !== t.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveTodo(null);
    const { active, over } = e;
    if (!over) return;

    // First manual drag on a date-ordered board: freeze the current display
    // order as the manual order, then process the drag on top of it.
    let working = todos;
    let colOf = byStatus;
    if (!ordered) {
      const frozen: KanbanTodo[] = [];
      for (const c of COLUMNS) {
        byStatus(c.id).forEach((t, i) => frozen.push({ ...t, sortOrder: i }));
      }
      const res = await initKanbanOrder(
        projectId,
        frozen.map((t) => ({ id: t.id, status: t.status, sortOrder: t.sortOrder }))
      );
      if (!res.ok) {
        alert(res.error);
        return;
      }
      working = frozen;
      colOf = (status: KanbanTodo["status"]) =>
        working.filter((t) => t.status === status).sort((a, b) => a.sortOrder - b.sortOrder);
      setOrdered(true);
      setTodos(frozen);
    }

    const dragged = working.find((t) => t.id === active.id);
    if (!dragged) return;

    let toStatus = dragged.status;
    let toIndex = dragged.sortOrder;
    const overId = String(over.id);

    if (overId.startsWith("column-")) {
      toStatus = overId.replace("column-", "") as KanbanTodo["status"];
      toIndex = colOf(toStatus).length;
    } else {
      const overTodo = working.find((t) => t.id === overId);
      if (overTodo) {
        toStatus = overTodo.status;
        const col = colOf(toStatus).filter((t) => t.id !== dragged.id);
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
      <div className="mb-3 flex items-center justify-end gap-3">
        <span className="text-xs text-slate-400" title={ordered ? "You rearranged this board — drag and drop to reorder" : "Earliest start date on top — drag any card to switch to manual ordering"}>
          {ordered ? "Custom order" : "Sorted by date"}
        </span>
        <button
          onClick={() => onNewTodo("TODO")}
          className="rounded-sm bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
        >
          + Add todo
        </button>
      </div>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 scroll-thin">
          {COLUMNS.map((c) => (
            <Column
              key={c.id}
              id={c.id}
              label={c.label}
              todos={byStatus(c.id)}
              showPriority={showPriority}
              canManage={canManage}
              onTodoClick={onTodoClick}
              onDeleteTodo={handleDeleteTodo}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTodo && (
            <div className="w-[276px] rotate-[2.5deg] shadow-2xl">
              <CardFace todo={activeTodo} showPriority={showPriority} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export { arrayMove };
