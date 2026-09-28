import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { shiftApi, useAction, useMe, useShifts, useSummary, useUsers } from "@/lib/queries";
import { addDays, fa, isoDay, parseDay, periodLabel, relativeDay } from "@/lib/format";
import ShiftCard from "@/components/ShiftCard";
import ShiftForm from "@/components/ShiftForm";
import { Empty, Loading, PeriodNav, Segmented, Sheet } from "@/components/ui";
import { groupByDate } from "../employee/Shifts";
import { cn } from "@/lib/cn";
import type { Shift } from "@/lib/types";

function PendingQueue({ onEdit }: { onEdit: (s: Shift) => void }) {
  const { data: me } = useMe();
  const { data } = useShifts({ status: "pending", limit: 500 });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const review = useAction((v: { ids: number[]; status: "approved" | "rejected"; note?: string }) => shiftApi.review(v.ids, v.status, v.note), {
    onSuccess: () => {
      setSelected(new Set());
      setRejecting(false);
      setNote("");
    },
  });

  if (!me || !data) return <Loading />;
  const done = data.filter((s) => s.end);
  if (!done.length) return <Empty emoji="🎉" title="صف تایید خالیه" text="هر شیفتی که بچه‌ها ثبت کنن اینجا میاد." />;

  const ids = selected.size ? [...selected] : done.map((s) => s.id);
  const toggle = (id: number) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  };

  return (
    <>
      <div className="flex flex-col gap-2 pb-20">
        {done.map((s) => (
          <ShiftCard
            key={s.id}
            shift={s}
            channels={me.channels}
            showUser
            onClick={() => onEdit(s)}
            leading={
              <span
                role="checkbox"
                aria-checked={selected.has(s.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(s.id);
                }}
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition",
                  selected.has(s.id) ? "border-primary bg-primary text-white" : "border-border",
                )}
              >
                {selected.has(s.id) && <Check size={14} strokeWidth={3} />}
              </span>
            }
          />
        ))}
      </div>
      <div className="fixed bottom-24 left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-[46rem] -translate-x-1/2 gap-2 rounded-2xl border border-border bg-popover/95 p-2 backdrop-blur">
        <button className="btn btn-primary h-11 flex-1" disabled={review.isPending} onClick={() => review.mutate({ ids, status: "approved" })}>
          <Check size={18} /> تایید {selected.size ? `${fa(selected.size)} مورد` : "همه"}
        </button>
        <button className="btn h-11" disabled={review.isPending} onClick={() => setRejecting(true)}>
          <X size={18} /> رد
        </button>
      </div>
      <Sheet open={rejecting} onOpenChange={setRejecting} title={`رد ${fa(ids.length)} شیفت`}>
        <textarea className="field h-auto min-h-24 py-2.5" placeholder="دلیل (به کارمند نشون داده می‌شه)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn-danger mt-4 h-12 w-full" onClick={() => review.mutate({ ids, status: "rejected", note })}>
          رد کن
        </button>
      </Sheet>
    </>
  );
}

function AllShifts({ onEdit }: { onEdit: (s: Shift) => void }) {
  const { data: me } = useMe();
  const { data: users } = useUsers();
  const [offset, setOffset] = useState(0);
  const [userId, setUserId] = useState(0);
  const summary = useSummary("month", offset);
  const p = summary.data?.period;
  const shifts = useShifts(
    { from: p?.start.slice(0, 10), to: p ? isoDay(addDays(parseDay(p.end.slice(0, 10)), -1)) : undefined, userId: userId || undefined, limit: 1000 },
    !!p,
  );
  if (!me || !p) return <Loading />;
  return (
    <div>
      <PeriodNav label={periodLabel(me.settings.calendar, p)} offset={offset} setOffset={setOffset} />
      <select className="field mt-3" value={userId} onChange={(e) => setUserId(+e.target.value)}>
        <option value={0}>همه افراد</option>
        {users?.map((u) => (
          <option key={u.id} value={u.id}>
            {u.avatar} {u.name}
          </option>
        ))}
      </select>
      <div className="mt-4 flex flex-col gap-4">
        {!shifts.data ? (
          <Loading />
        ) : shifts.data.length === 0 ? (
          <Empty emoji="🗓️" title="شیفتی پیدا نشد" />
        ) : (
          groupByDate(shifts.data).map(([date, list]) => (
            <div key={date}>
              <div className="mb-1.5 text-xs font-medium text-muted">{relativeDay(me.settings.calendar, date)}</div>
              <div className="flex flex-col gap-2">
                {list.map((s) => (
                  <ShiftCard key={s.id} shift={s} channels={me.channels} showUser onClick={() => s.end && onEdit(s)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminShifts() {
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [editing, setEditing] = useState<Shift | null>(null);
  const [open, setOpen] = useState(false);
  const edit = (s: Shift) => {
    setEditing(s);
    setOpen(true);
  };

  return (
    <div className="rise">
      <div className="flex items-center gap-2">
        <Segmented
          className="flex-1"
          value={tab}
          onChange={setTab}
          options={[
            { value: "pending", label: "صف تایید" },
            { value: "all", label: "همه شیفت‌ها" },
          ]}
        />
        <button
          className="btn btn-primary h-11 w-11 px-0"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          aria-label="ثبت شیفت برای کارمند"
        >
          <Plus size={20} />
        </button>
      </div>
      <div className="mt-4">{tab === "pending" ? <PendingQueue onEdit={edit} /> : <AllShifts onEdit={edit} />}</div>
      <ShiftForm open={open} onOpenChange={setOpen} shift={editing} asAdmin />
    </div>
  );
}
