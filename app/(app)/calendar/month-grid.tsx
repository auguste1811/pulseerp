import Link from "next/link";

type EventItem = {
  id: string;
  title: string;
  event_type: string;
  status: string;
  start_at: string | Date;
};

const typeLabels: Record<string, string> = {
  MEETING: "RDV",
  CALL: "Appel",
  FOLLOW_UP: "Relance",
  DEADLINE: "Échéance",
  PAYMENT: "Paiement",
  CAMPAIGN: "Campagne",
  OTHER: "Autre",
};

export function MonthGrid({
  year,
  month,
  events,
}: {
  year: number;
  month: number;
  events: EventItem[];
}) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((mondayOffset + lastDay.getDate()) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - mondayOffset + 1;
    return dayNumber >= 1 && dayNumber <= lastDay.getDate() ? dayNumber : null;
  });

  const today = new Date();

  return (
    <div className="calendar-month">
      {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((day) => (
        <div className="calendar-weekday" key={day}>{day}</div>
      ))}

      {cells.map((day, index) => {
        if (!day) return <div className="calendar-day empty" key={index} />;

        const dayEvents = events.filter((event) => {
          const date = new Date(event.start_at);
          return date.getFullYear() === year &&
            date.getMonth() === month &&
            date.getDate() === day;
        });

        const isToday =
          today.getFullYear() === year &&
          today.getMonth() === month &&
          today.getDate() === day;

        return (
          <div className={`calendar-day ${isToday ? "today" : ""}`} key={index}>
            <span className="calendar-day-number">{day}</span>
            <div className="calendar-day-events">
              {dayEvents.slice(0, 3).map((event) => (
                <Link
                  className={`calendar-event-chip ${event.event_type.toLowerCase()} ${event.status.toLowerCase()}`}
                  href={`/calendar/${event.id}`}
                  key={event.id}
                >
                  <small>{new Date(event.start_at).toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit"})}</small>
                  <span>{event.title}</span>
                  <em>{typeLabels[event.event_type] ?? event.event_type}</em>
                </Link>
              ))}
              {dayEvents.length > 3 && (
                <small className="calendar-more">+ {dayEvents.length - 3} autre(s)</small>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
