import Reveal from '../Reveal.jsx'
import { Rings } from '../Botanicals.jsx'
import TaskItem from './TaskItem.jsx'

/**
 * The checklist card. Tasks keep the order they were added in; completed tasks stay in place.
 * `ref` (React 19 ref-as-prop) points at the <ul> so the page can move focus after a deletion.
 */
export default function TaskList({ ref, tasks, onToggle, onRename, onDelete }) {
  return (
    <Reveal as="section" className="card task-list-card" aria-labelledby="task-list-title">
      <div className="list-head">
        <h2 id="task-list-title">הרשימה שלנו</h2>
      </div>
      {tasks.length > 0 ? (
        <ul className="task-list" ref={ref} aria-labelledby="task-list-title">
          {tasks.map((task, index) => (
            <TaskItem key={task.id} task={task} index={index} onToggle={onToggle} onRename={onRename} onDelete={onDelete} />
          ))}
        </ul>
      ) : (
        <div className="tasks-empty">
          <div className="tasks-empty-art" aria-hidden="true"><Rings /></div>
          <h3>הרשימה שלכם מחכה</h3>
          <p>מה הדבר הראשון שצריך לסגור? כתבו אותו למעלה.</p>
        </div>
      )}
    </Reveal>
  )
}
