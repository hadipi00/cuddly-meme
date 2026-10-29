import Icon from '../../components/Icon'
import { StatCard } from '../../components/PanelLayout'
import { RatingStars } from '../../components/ui'
import { teacherReviews } from '../../data/mock'
import { faNum, faDate } from '../../utils/format'

export default function TReviews() {
  return (
    <div>
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <StatCard icon="star" color="amber" label="امتیاز کلی" value="۴.۹ از ۵" trend={2} />
        <StatCard icon="chat" color="teal" label="تعداد نظرات" value={faNum(1240)} trend={14} />
        <StatCard icon="heart" color="violet" label="نظرات ۵ ستاره" value="۸۹٪" trend={4} />
      </div>

      <div className="grids g2">
        {teacherReviews.map((r) => (
          <div className="card pad" key={r.id}>
            <div className="between mb8">
              <RatingStars value={r.rating} />
              <span className="muted small">{faDate(r.date)}</span>
            </div>
            <b className="small">{r.student}</b>
            <span className="muted small"> — درباره «{r.course}»</span>
            <p className="muted small mt8" style={{ lineHeight: 2 }}>«{r.text}»</p>
          </div>
        ))}
      </div>
    </div>
  )
}
