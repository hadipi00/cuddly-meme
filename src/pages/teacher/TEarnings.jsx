import Icon from '../../components/Icon'
import { StatCard } from '../../components/PanelLayout'
import { LineChart } from '../../components/Charts'
import DataTable from '../../components/DataTable'
import { teacherEarnings } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, toman } from '../../utils/format'

const payouts = [
  { id: 'PO-88', period: 'آبان ۱۴۰۴', amount: 95000000, date: '1404/09/01', status: 'paid' },
  { id: 'PO-87', period: 'مهر ۱۴۰۴', amount: 76000000, date: '1404/08/01', status: 'paid' },
  { id: 'PO-86', period: 'شهریور ۱۴۰۴', amount: 88000000, date: '1404/07/01', status: 'paid' },
]

export default function TEarnings() {
  const { toast } = useApp()
  return (
    <div>
      <div className="stat-cards">
        <StatCard icon="wallet" color="teal" label="درآمد این ماه" value={`${faNum(112)} م.ت`} trend={18} />
        <StatCard icon="wallet" color="green" label="تسویه‌شده کل" value={`${faNum(613)} م.ت`} />
        <StatCard icon="clock" color="amber" label="در انتظار تسویه" value={`${faNum(17)} م.ت`} />
        <StatCard icon="users" color="violet" label="سهم از هر فروش" value="۷۰٪" />
      </div>

      <div className="card chart-card mb22">
        <h3>روند درآمد ماهانه (میلیون تومان)</h3>
        <div className="chart-sub">فروش دوره‌های ضبط‌شده + کلاس‌های زنده</div>
        <LineChart data={teacherEarnings} color="#34d399" color2="#2dd4bf" unit="م" />
      </div>

      <div className="card pad mb22">
        <div className="between wrap">
          <div>
            <b>درخواست تسویه حساب</b>
            <p className="muted small">موجودی قابل برداشت فعلی شما: {toman(17000000)}</p>
          </div>
          <button className="btn btn-primary" onClick={() => toast('درخواست تسویه ثبت شد — ظرف ۳ روز کاری واریز می‌شود')}>
            <Icon name="creditCard" size={16} /> درخواست تسویه
          </button>
        </div>
      </div>

      <div className="card pad">
        <h3 className="mb16">تسویه‌های قبلی</h3>
        <DataTable
          columns={[
            { key: 'id', label: 'کد', render: (r) => <span className="cell-strong" dir="ltr" style={{ textAlign: 'right' }}>{r.id}</span> },
            { key: 'period', label: 'دوره' },
            { key: 'amount', label: 'مبلغ', render: (r) => toman(r.amount) },
            { key: 'date', label: 'تاریخ واریز' },
            { key: 'status', label: 'وضعیت', render: () => <span className="badge b-green">واریز شد</span> },
          ]}
          rows={payouts}
          pageSize={5}
        />
      </div>
    </div>
  )
}
