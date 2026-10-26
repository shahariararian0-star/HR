import React from 'react';
import { ChevronDown, UserCog, CheckCircle2, UserPlus, FileText, CalendarDays, Receipt, Clock } from 'lucide-react';
import { Bars, Donut, DonutLegend, DEPARTMENT_SLICES, Initials } from './MockCharts';

// "A smarter way" — a static tour of the dashboard widgets. Sample data only.

const PEOPLE = [
  { name: 'Alex Morgan', dept: 'Management' },
  { name: 'Jordan Chen', dept: 'Engineering' },
  { name: 'Taylor Reed', dept: 'Marketing' },
  { name: 'Sam Rivera', dept: 'Operations' },
];

const LEAVES = [
  { name: 'Taylor Reed', dates: 'Mar 10 – Mar 14', status: 'Approved' },
  { name: 'Sam Rivera', dates: 'Mar 12 – Mar 13', status: 'Pending' },
  { name: 'Jordan Chen', dates: 'Mar 18 – Mar 22', status: 'Pending' },
];

const ACTIVITY = [
  { icon: UserCog, tone: 'bg-[#1677FF]/15 text-[#1677FF]', text: 'Jordan Chen updated their profile', time: '10 mins ago' },
  { icon: CheckCircle2, tone: 'bg-emerald-500/15 text-emerald-500', text: 'Leave request approved for Taylor Reed', time: '2 hours ago' },
  { icon: UserPlus, tone: 'bg-violet-500/15 text-violet-500', text: 'New employee onboarded: Sam Rivera', time: '4 hours ago' },
  { icon: FileText, tone: 'bg-pink-500/15 text-pink-500', text: 'March hours report exported', time: '5 hours ago' },
];

const APPROVALS = [
  { icon: CalendarDays, label: 'Leave requests', count: 2 },
  { icon: Receipt, label: 'Profile changes', count: 1 },
  { icon: Clock, label: 'Missed check-outs', count: 0 },
];

const Card: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  action,
  children,
  className = '',
}) => (
  <div className={`rounded-2xl border border-dl-hair bg-dl-surface p-5 shadow-dl-1 ${className}`}>
    <div className="flex items-center justify-between gap-2 mb-4">
      <h3 className="text-sm font-bold text-dl-ink">{title}</h3>
      {action ?? <span className="text-xs font-semibold text-dl-teal">View all</span>}
    </div>
    {children}
  </div>
);

const statusTone = (s: string) =>
  s === 'Approved' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400';

const ProductPreviewSection: React.FC = () => (
  <section id="preview" className="py-20 md:py-24 bg-dl-ground">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="font-dl-display text-3xl sm:text-4xl font-extrabold text-dl-ink tracking-tight mb-4">
          A Smarter Way to <span className="sc-gradient-text">Manage Your People</span>
        </h2>
        <p className="text-base sm:text-lg text-dl-muted leading-relaxed">
          Get a complete view of your workforce with real-time insights. Admins and managers see who
          is in, who is away and what needs their approval the moment they open the app, while
          employees get a simple screen to check in, take breaks and apply for leave.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" aria-hidden="true">
        {/* Left column */}
        <div className="space-y-5 min-w-0">
          <Card title="Employee Overview">
            <div className="grid grid-cols-4 gap-2">
              {PEOPLE.map((p, i) => (
                <div key={p.name} className="flex flex-col items-center text-center min-w-0">
                  <Initials name={p.name} size={44} tone={i} />
                  <span className="mt-2 text-[11px] font-semibold text-dl-ink truncate w-full">{p.name}</span>
                  <span className="text-[10px] text-dl-soft truncate w-full">{p.dept}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Leave Requests">
            <ul className="space-y-3">
              {LEAVES.map((l, i) => (
                <li key={l.name} className="flex items-center gap-3">
                  <Initials name={l.name} size={34} tone={i + 2} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-dl-ink truncate">{l.name}</div>
                    <div className="text-[11px] text-dl-soft">{l.dates}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${statusTone(l.status)}`}>{l.status}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Middle column */}
        <div className="space-y-5 min-w-0">
          <Card
            title="Headcount Growth"
            action={
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dl-hair text-[10px] text-dl-muted">
                Last 6 months <ChevronDown size={11} />
              </span>
            }
          >
            <Bars values={[30, 42, 52, 64, 82, 96]} labels={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']} height={130} stacked />
          </Card>
          <Card title="Department Distribution" action={<span />}>
            <div className="flex items-center gap-5">
              <Donut slices={DEPARTMENT_SLICES} total="248" caption="Employees" size={128} />
              <DonutLegend slices={DEPARTMENT_SLICES} />
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5 min-w-0">
          <Card title="Activity Feed">
            <ul className="space-y-3.5">
              {ACTIVITY.map(({ icon: Icon, tone, text, time }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs text-dl-ink leading-snug">{text}</div>
                    <div className="text-[10px] text-dl-soft mt-0.5">{time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card
            title="Pending Approvals"
            action={<span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">3</span>}
          >
            <ul className="space-y-3">
              {APPROVALS.map(({ icon: Icon, label, count }) => (
                <li key={label} className="flex items-center justify-between text-xs text-dl-ink">
                  <span className="flex items-center gap-2.5">
                    <Icon size={14} className="text-dl-teal" /> {label}
                  </span>
                  <span className="w-6 h-6 rounded-full bg-dl-surface-2 border border-dl-hair-soft text-[10px] font-semibold flex items-center justify-center">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <p className="text-center text-xs text-dl-soft mt-6">Screens shown with sample data.</p>
    </div>
  </section>
);

export default ProductPreviewSection;
