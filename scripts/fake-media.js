// دوربین و میکروفون مجازی برای تست اتاق کلاس زنده در مرورگر headless
// کانواس متحرک (سه رنگ چرخشی + شمارنده) به‌عنوان ویدیو + اسیلاتور صوتی
(() => {
  if (window.__fakeMediaPatched) return 'already'
  window.__fakeMediaPatched = true
  const canvas = document.createElement('canvas')
  canvas.width = 640; canvas.height = 480
  canvas.id = '__fakecam'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  let t = 0
  window.__fakeCamTick = setInterval(() => {
    t++
    ctx.fillStyle = ['#0369a1', '#b45309', '#15803d'][t % 3]
    ctx.fillRect(0, 0, 640, 480)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 54px sans-serif'
    ctx.fillText('FAKE-CAM ' + t, 120, 260)
  }, 400)
  const vStream = canvas.captureStream(12)
  window.__fakeVideoTrack = vStream.getVideoTracks()[0]
  const ac = new AudioContext()
  const osc = ac.createOscillator()
  osc.frequency.value = 440
  const gain = ac.createGain(); gain.gain.value = 0.05
  const dest = ac.createMediaStreamDestination()
  osc.connect(gain); gain.connect(dest); osc.start()
  window.__fakeAudioTrack = dest.stream.getAudioTracks()[0]
  const mkStream = (wantV, wantA) => {
    const tracks = []
    if (wantV && window.__fakeVideoTrack) tracks.push(window.__fakeVideoTrack)
    if (wantA && window.__fakeAudioTrack) tracks.push(window.__fakeAudioTrack)
    return new MediaStream(tracks)
  }
  const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  navigator.mediaDevices.getUserMedia = async (c = {}) => {
    const wantV = c.video !== false && !!c.video !== false && c.video !== undefined
    const wantA = c.audio !== false && c.audio !== undefined
    if (c.video === false && c.audio === false) return new MediaStream([])
    if (c.video === false) return mkStream(false, true)
    if (c.audio === false) return mkStream(true, false)
    return mkStream(true, true)
  }
  navigator.mediaDevices.enumerateDevices = async () => ([
    { deviceId: 'fake1', kind: 'videoinput', label: 'Fake Camera 1 (front)', groupId: 'g1' },
    { deviceId: 'fake2', kind: 'videoinput', label: 'Fake Camera 2 (back)', groupId: 'g1' },
    { deviceId: 'fake-a', kind: 'audioinput', label: 'Fake Mic', groupId: 'g2' },
  ])
  return 'patched'
})()
