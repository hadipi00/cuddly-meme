import { useParams } from 'react-router-dom'
import LiveRoom from '../../components/LiveRoom'
import { liveClasses } from '../../data/mock'

export default function SLiveRoom() {
 const { classId } = useParams()
 const cls = liveClasses.find((l) => l.id === classId)
 return <LiveRoom variant="student" classInfo={cls} />
}
