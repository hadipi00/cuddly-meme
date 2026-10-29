import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { Avatar } from '../../components/ui'
import { teacherStudents } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum } from '../../utils/format'

export default function TStudents() {
  const { toast } = useApp()
  return (
    <div>
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <StatCard icon="users" color="teal" label="دانشجوی فعال من" value={faNum(3260)} trend={11} />
        <StatCard icon="check" color="green" label="میانگین پیشرفت" value="۶۱٪" trend={6} />
        <StatCard icon="clock" color="amber" label="میانگین مطالعه دانشجوها" value="۴.۲ ساعت/هفته" trend={9} />
      </div>

      <div className="card pad">
        <DataTable
          columns={[
            { key: 'name', label: 'دانشجو', render: (r) => (
              <div className="cell-user"><Avatar name={r.name} size={34} color="grad-0" /><span className="cell-strong">{r.name}</span></div>
            ) },
            { key: 'courses', label: 'دوره‌ها' },
            { key: 'progress', label: 'پیشرفت', render: (r) => (
              <div style={{ minWidth: 110 }}>
                <div className="progress"><i style={{ width: `${r.progress}%` }} /></div>
                <span className="muted small">{faNum(r.progress)}٪</span>
              </div>
            ) },
            { key: 'lastSeen', label: 'آخرین فعالیت' },
            { key: 'status', label: 'وضعیت', render: (r) => r.status === 'active' ? <span className="status-dot green"><i />فعال</span>
              : r.status === 'done' ? <span className="status-dot sky"><i />تکمیل</span> : <span className="status-dot amber"><i />کم‌فعال</span> },
          ]}
          rows={teacherStudents}
          searchKeys={['name', 'courses']}
          filters={[{ key: 'status', label: 'وضعیت', options: ['فعال', 'تکمیل', 'کم‌فعال'], match: (r, v) => (r.status === 'active' ? 'فعال' : r.status === 'done' ? 'تکمیل' : 'کم‌فعال') === v }]}
          emptyText="دانشجویی یافت نشد."
          actions={(r) => (
            <>
              <button className="icon-btn" title="پیام" onClick={() => toast(`پیام به ${r.name} ارسال شد`)}><Icon name="chat" /></button>
              <button className="icon-btn" title="کارنامه" onClick={() => toast('کارنامه دانشجو باز شد', 'info')}><Icon name="file" /></button>
            </>
          )}
        />
      </div>
    </div>
  )
}
