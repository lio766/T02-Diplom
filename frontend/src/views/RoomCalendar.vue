<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const rooms = ref([])
const roomId = ref('')

const loadingRooms = ref(false)
const loadingBookings = ref(false)
const error = ref('')

const weekCursor = ref(new Date())

const startHour = 7
const endHour = 19
const pxPerMinute = 1.2 // visual scale (height)

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toIsoDate(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`
}

function startOfWeekMonday(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay() // 0=Sun .. 6=Sat
  const delta = (day === 0 ? -6 : 1 - day) // move to Monday
  x.setDate(x.getDate() + delta)
  return x
}

const weekStart = computed(() => startOfWeekMonday(weekCursor.value))
const weekDays = computed(() => {
  const base = weekStart.value
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return d
  })
})

const weekLabel = computed(() => {
  const a = weekDays.value[0]
  const b = weekDays.value[6]
  return `${pad2(a.getDate())}.${pad2(a.getMonth() + 1)}.${a.getFullYear()} – ${pad2(b.getDate())}.${pad2(b.getMonth() + 1)}.${b.getFullYear()}`
})

const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const timeSlots = computed(() => {
  const out = []
  for (let h = startHour; h <= endHour; h++) out.push(`${pad2(h)}:00`)
  return out
})

const gridHeightPx = computed(() => (endHour - startHour) * 60 * pxPerMinute)

const bookings = ref([])

const selectedBooking = ref(null)
const showDetails = ref(false)

const todayIso = computed(() => toIsoDate(new Date()))

const now = ref(new Date())
const nowTimer = setInterval(() => {
  now.value = new Date()
}, 30_000)

onUnmounted(() => {
  clearInterval(nowTimer)
})

function parseTimeToMinutes(timeHHmm) {
  const [hh, mm] = String(timeHHmm).split(':').map(Number)
  return (hh * 60) + (mm || 0)
}

const nowMinutes = computed(() => (now.value.getHours() * 60) + now.value.getMinutes())
const nowLabel = computed(() => `${pad2(now.value.getHours())}:${pad2(now.value.getMinutes())}`)

const showNowLine = computed(() => {
  const min = startHour * 60
  const max = endHour * 60
  return nowMinutes.value >= min && nowMinutes.value <= max
})

const nowLineStyle = computed(() => {
  const top = (nowMinutes.value - (startHour * 60)) * pxPerMinute
  return { top: `${clamp(top, 0, gridHeightPx.value)}px` }
})

function layoutDayBookings(dayBookings) {
  const evs = dayBookings
    .map((b) => {
      const startMin = parseTimeToMinutes(b.start_time)
      const endMin = parseTimeToMinutes(b.end_time)
      return {
        ...b,
        _startMin: startMin,
        _endMin: endMin,
        _col: 0,
        _colCount: 1,
      }
    })
    .sort((a, b) => (a._startMin - b._startMin) || (b._endMin - a._endMin))

  const groups = []
  let group = []
  let groupEnd = -Infinity

  for (const ev of evs) {
    if (group.length === 0) {
      group = [ev]
      groupEnd = ev._endMin
      continue
    }

    if (ev._startMin < groupEnd) {
      group.push(ev)
      groupEnd = Math.max(groupEnd, ev._endMin)
    } else {
      groups.push(group)
      group = [ev]
      groupEnd = ev._endMin
    }
  }
  if (group.length) groups.push(group)

  for (const g of groups) {
    const colEnd = []
    for (const ev of g) {
      let col = -1
      for (let i = 0; i < colEnd.length; i++) {
        if (colEnd[i] <= ev._startMin) { col = i; break }
      }
      if (col === -1) {
        col = colEnd.length
        colEnd.push(ev._endMin)
      } else {
        colEnd[col] = ev._endMin
      }
      ev._col = col
    }
    const total = Math.max(1, colEnd.length)
    for (const ev of g) ev._colCount = total
  }

  return evs
}

function minutesFromGridStart(timeHHmm) {
  return parseTimeToMinutes(timeHHmm) - (startHour * 60)
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function bookingStyle(b) {
  const top = minutesFromGridStart(b.start_time) * pxPerMinute
  const height = (parseTimeToMinutes(b.end_time) - parseTimeToMinutes(b.start_time)) * pxPerMinute
  const col = Number.isFinite(b._col) ? b._col : 0
  const colCount = Number.isFinite(b._colCount) && b._colCount > 0 ? b._colCount : 1
  const leftPct = (col / colCount) * 100
  const rightPct = 100 - ((col + 1) / colCount) * 100
  return {
    top: `${clamp(top, 0, gridHeightPx.value)}px`,
    height: `${Math.max(18, clamp(height, 10, gridHeightPx.value))}px`,
    left: `${leftPct}%`,
    right: `${rightPct}%`,
  }
}

function bookingParticipantsLabel(b) {
  const parts = Array.isArray(b?.participants) ? b.participants : []
  const names = parts.map((p) => p?.name || p?.email).filter(Boolean)
  if (names.length) return names.join(', ')
  return b?.person || 'Belegt'
}

function openDetails(b) {
  selectedBooking.value = b
  showDetails.value = true
}

function closeDetails() {
  showDetails.value = false
  selectedBooking.value = null
}

function weekRangeQuery() {
  const from = toIsoDate(weekDays.value[0])
  const to = toIsoDate(weekDays.value[6])
  return { from, to }
}

async function loadRooms() {
  loadingRooms.value = true
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/rooms`)
    if (!res.ok) throw new Error('Fehler beim Laden der Räume')
    rooms.value = await res.json()
    if (!roomId.value && rooms.value.length) roomId.value = String(rooms.value[0].id)
  } catch (e) {
    error.value = e.message
  } finally {
    loadingRooms.value = false
  }
}

async function loadBookings() {
  if (!roomId.value) {
    bookings.value = []
    return
  }

  loadingBookings.value = true
  error.value = ''
  try {
    const { from, to } = weekRangeQuery()
    const url = new URL(`${API_BASE}/bookings`, window.location.origin)
    url.searchParams.set('room_id', String(roomId.value))
    url.searchParams.set('from', from)
    url.searchParams.set('to', to)

    const res = await fetch(url.toString().replace(window.location.origin, ''))
    if (!res.ok) throw new Error('Fehler beim Laden der Buchungen')
    bookings.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loadingBookings.value = false
  }
}

function bookingsForDay(dayDate) {
  const iso = toIsoDate(dayDate)
  const day = bookings.value
    .filter((b) => b.date === iso)
    .slice()
  return layoutDayBookings(day)
}

function prevWeek() {
  const d = new Date(weekCursor.value)
  d.setDate(d.getDate() - 7)
  weekCursor.value = d
}

function nextWeek() {
  const d = new Date(weekCursor.value)
  d.setDate(d.getDate() + 7)
  weekCursor.value = d
}

function goToday() {
  weekCursor.value = new Date()
}

watch([roomId, weekCursor], () => { loadBookings() })

onMounted(async () => {
  await loadRooms()
  await loadBookings()
})
</script>

<template>
  <section class="page">
    <header class="topbar">
      <div class="title">
        <h1>Raum-Kalender</h1>
        <p class="subtitle">Wähle einen Raum und sieh die Belegung in der Wochenansicht.</p>
      </div>

      <div class="controls">
        <label class="field">
          Raum
          <select v-model="roomId" :disabled="loadingRooms">
            <option v-for="r in rooms" :key="r.id" :value="String(r.id)">
              {{ r.name || r.Bezeichnung || r.bezeichnung }}
            </option>
          </select>
        </label>

        <div class="weeknav">
          <button class="btn" type="button" @click="prevWeek">◀</button>
          <button class="btn" type="button" @click="goToday">Heute</button>
          <button class="btn" type="button" @click="nextWeek">▶</button>
        </div>

        <div class="weeklabel">{{ weekLabel }}</div>
      </div>
    </header>

    <p v-if="error" class="msg error">{{ error }}</p>

    <div class="calendarCard">
      <div class="headerRow">
        <div class="corner"></div>
        <div v-for="(d, idx) in weekDays" :key="toIsoDate(d)" class="dayHeader" :class="{ today: toIsoDate(d) === todayIso }">
          <div class="dow">{{ dayLabels[idx] }}</div>
          <div class="date">{{ pad2(d.getDate()) }}.{{ pad2(d.getMonth() + 1) }}</div>
        </div>
      </div>

      <div class="body" :style="{ height: gridHeightPx + 'px' }">
        <div class="timeCol">
          <div v-for="t in timeSlots" :key="t" class="timeTick" :style="{ height: (60 * pxPerMinute) + 'px' }">
            <span>{{ t }}</span>
          </div>
        </div>

        <div class="days">
          <div
            v-for="d in weekDays"
            :key="toIsoDate(d)"
            class="dayCol"
            :class="{ today: toIsoDate(d) === todayIso }"
            :style="{ height: gridHeightPx + 'px' }"
          >
            <div v-if="toIsoDate(d) === todayIso && showNowLine" class="nowLine" :style="nowLineStyle">
              <span class="nowLabel">{{ nowLabel }}</span>
            </div>

            <div
              v-for="h in (endHour - startHour)"
              :key="h"
              class="hourLine"
              :style="{ top: (h * 60 * pxPerMinute) + 'px' }"
            ></div>

            <div
              v-for="b in bookingsForDay(d)"
              :key="b.id"
              class="booking"
              :style="bookingStyle(b)"
              :title="`${b.start_time}–${b.end_time} ${bookingParticipantsLabel(b)}`.trim()"
              role="button"
              tabindex="0"
              @click="openDetails(b)"
              @keydown.enter.prevent="openDetails(b)"
            >
              <div class="bookingTime">{{ b.start_time }}–{{ b.end_time }}</div>
              <div class="bookingPerson">{{ bookingParticipantsLabel(b) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="footer">
        <span v-if="loadingBookings">Lade Buchungen…</span>
        <span v-else> {{ bookings.length }} Buchung(en) in dieser Woche </span>
      </div>
    </div>

    <RouterLink to="/booking" class="back">Zur Buchung</RouterLink>

    <div v-if="showDetails" class="modalOverlay" @click.self="closeDetails">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modalHead">
          <h2 class="modalTitle">Buchungsdetails</h2>
          <button class="btn" type="button" @click="closeDetails">Schließen</button>
        </div>

        <div v-if="selectedBooking" class="modalBody">
          <div class="detailRow">
            <span class="k">Raum</span>
            <span class="v">{{ selectedBooking.room }}</span>
          </div>
          <div class="detailRow">
            <span class="k">Datum</span>
            <span class="v">{{ selectedBooking.date }}</span>
          </div>
          <div class="detailRow">
            <span class="k">Zeitraum</span>
            <span class="v">{{ selectedBooking.start_time }} – {{ selectedBooking.end_time }}</span>
          </div>

          <div class="detailRow top">
            <span class="k">Eingetragene Benutzer</span>
            <span class="v">
              <template v-if="Array.isArray(selectedBooking.participants) && selectedBooking.participants.length">
                <ul class="participants">
                  <li v-for="p in selectedBooking.participants" :key="p.id">
                    {{ p.name || p.email }}<span v-if="p.email && p.name"> ({{ p.email }})</span>
                  </li>
                </ul>
              </template>
              <template v-else>
                <span>—</span>
              </template>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page { min-height: 70vh; color: #e5e7eb; background: #0f172a; padding: 1.5rem 1rem 2.5rem; display: grid; gap: 1rem; }
.topbar { display: grid; gap: 0.75rem; }
.title h1 { margin: 0; }
.subtitle { margin: 0.25rem 0 0; color: #94a3b8; }

.controls { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; justify-content: space-between; }
.field { display: grid; gap: 0.35rem; font-size: 0.9rem; }
select { min-width: 260px; background: #0b1222; border: 1px solid #243146; color: #e5e7eb; padding: 0.6rem 0.7rem; border-radius: 0.5rem; }

.weeknav { display: flex; gap: 0.5rem; align-items: center; }
.btn { background: #111827; border: 1px solid #1f2937; color: #e5e7eb; padding: 0.5rem 0.75rem; border-radius: 0.5rem; cursor: pointer; }
.btn:hover { border-color: #334155; }
.weeklabel { color: #94a3b8; font-size: 0.95rem; }

.msg { margin: 0; font-size: 0.95rem; }
.msg.error { color: #fca5a5; }

.calendarCard { background: #111827; border: 1px solid #1f2937; border-radius: 0.9rem; overflow: hidden; }
.headerRow { display: grid; grid-template-columns: 72px repeat(7, 1fr); background: #0b1222; border-bottom: 1px solid #1f2937; }
.corner { border-right: 1px solid #1f2937; }
.dayHeader { padding: 0.6rem 0.5rem; border-right: 1px solid #1f2937; display: grid; gap: 0.15rem; }
.dayHeader:last-child { border-right: none; }
.dayHeader.today { background: rgba(66, 184, 131, 0.12); }
.dow { font-weight: 700; color: #e5e7eb; }
.date { color: #94a3b8; font-size: 0.9rem; }

.body { display: grid; grid-template-columns: 72px 1fr; }
.timeCol { border-right: 1px solid #1f2937; background: #0b1222; }
.timeTick { position: relative; display: flex; justify-content: flex-end; padding: 0.2rem 0.5rem; box-sizing: border-box; border-bottom: 1px solid rgba(31, 41, 55, 0.45); }
.timeTick span { color: #94a3b8; font-size: 0.85rem; }

.days { display: grid; grid-template-columns: repeat(7, 1fr); }
.dayCol { position: relative; border-right: 1px solid #1f2937; background: linear-gradient(to bottom, rgba(148, 163, 184, 0.06) 1px, transparent 1px); background-size: 100% calc(30px); }
.dayCol:last-child { border-right: none; }
.dayCol.today { background-color: rgba(66, 184, 131, 0.06); }
.hourLine { position: absolute; left: 0; right: 0; height: 1px; background: rgba(148, 163, 184, 0.18); }

.nowLine { position: absolute; left: 0; right: 0; height: 2px; background: #ef4444; z-index: 3; }
.nowLabel { position: absolute; left: 6px; top: -10px; font-size: 0.75rem; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(239, 68, 68, 0.45); color: #fecaca; padding: 0.1rem 0.35rem; border-radius: 999px; }

.booking { position: absolute; background: rgba(66, 184, 131, 0.18); border: 1px solid rgba(66, 184, 131, 0.45); border-left: 4px solid #42b883; border-radius: 0.5rem; padding: 0.35rem 0.45rem; overflow: hidden; margin: 0 4px; }
.booking { cursor: pointer; }
.booking:focus { outline: 2px solid rgba(66, 184, 131, 0.85); outline-offset: 2px; }
.bookingTime { font-size: 0.8rem; color: #d1fae5; font-weight: 700; }
.bookingPerson { font-size: 0.85rem; color: #e5e7eb; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }

.footer { padding: 0.6rem 0.9rem; border-top: 1px solid #1f2937; color: #94a3b8; font-size: 0.9rem; }

.back { color: #94a3b8; width: fit-content; }

.modalOverlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: grid; place-items: center; padding: 1rem; z-index: 50; }
.modal { width: min(720px, 100%); background: #111827; border: 1px solid #1f2937; border-radius: 0.9rem; padding: 1rem; display: grid; gap: 0.75rem; }
.modalHead { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.modalTitle { margin: 0; font-size: 1.1rem; }
.modalBody { display: grid; gap: 0.6rem; }
.detailRow { display: grid; grid-template-columns: 160px 1fr; gap: 0.75rem; align-items: start; }
.detailRow.top { align-items: start; }
.k { color: #94a3b8; font-size: 0.9rem; }
.v { color: #e5e7eb; }
.participants { margin: 0.25rem 0 0; padding-left: 1.1rem; }
.participants li { margin: 0.1rem 0; }
</style>
