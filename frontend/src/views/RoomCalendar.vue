<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BookingForm from '../components/BookingForm.vue'
import api from '../lib/api.js'
import {getToken, useKeycloak } from '@josempgon/vue-keycloak';
const {isPending, isAuthenticated, error, username, userId, keycloak, roles, hasRoles } = useKeycloak();

const { t, tm } = useI18n()

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const rooms = ref([])
const roomId = ref('')
const onlyMine = ref(false)

const loadingRooms = ref(false)
const loadingBookings = ref(false)
const errorCalender = ref('')

const currentView = ref('calendar') // 'calendar' or 'table'
const showBookingPanel = ref(false)

const showRoomDropdown = ref(false)

const currentRoomName = computed(() => {
  if (onlyMine.value) return t('calendar.toolbar.myCalendar')
  const r = rooms.value.find(r => String(r.id) === roomId.value)
  return r ? (r.name || r.Bezeichnung || r.bezeichnung) : (t('calendar.selectRoom') || 'Select Room')
})

function toggleRoomDropdown() {
  if (onlyMine.value) return
  showRoomDropdown.value = !showRoomDropdown.value
}

function toggleMyCalendar() {
  if (onlyMine.value) {
     onlyMine.value = false;
     if (!roomId.value && rooms.value.length) roomId.value = String(rooms.value[0].id)
  } else {
     onlyMine.value = true
  }
}

function selectRoom(id) {
  roomId.value = String(id)
  onlyMine.value = false
  showRoomDropdown.value = false
}

function closeRoomDropdown(e) {
  if (!e.target.closest('.room-dropdown-wrapper')) {
    showRoomDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeRoomDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeRoomDropdown)
  clearInterval(nowTimer)
})

const token = computed(() => getToken())


const weekCursor = ref(new Date())
const weekPickerInput = ref(null)

function openWeekPicker() {
  if (weekPickerInput.value) {
    if (typeof weekPickerInput.value.showPicker === 'function') {
      weekPickerInput.value.showPicker()
    } else {
      weekPickerInput.value.click()
    }
  }
}

function onWeekPicked(e) {
  const val = e.target.value
  if (val) {
    weekCursor.value = new Date(val)
  }
}

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

const dayLabels = computed(() => tm('days'))

const timeSlots = computed(() => {
  const out = []
  for (let h = startHour; h < endHour; h++) out.push(`${pad2(h)}:00`)
  return out
})

const gridHeightPx = computed(() => (endHour - startHour) * 60 * pxPerMinute)

const bookings = ref([])

const selectedBooking = ref(null)
const showDetails = ref(false)

const isLoggedIn = computed(() => isAuthenticated.value)
const isGenehmiger = computed(() => {
    return hasRoles(['genehmiger'])
})
const isAdmin = computed(() => {
    return hasRoles(['administrator'])
})
const canEditCurrentBooking = computed(() => {
  return selectedBooking.value && selectedBooking.value.requester_sub === userId.value
})
const canDeleteCurrentBooking = computed(() => {
  return (selectedBooking.value && selectedBooking.value.requester_sub === userId.value) || isGenehmiger.value
})

const decidingId = ref(null)
async function decideApproval(decision) {
console.log('Entscheidung:', decision, 'für Buchung ID:', selectedBooking.value?.id)
  const id = Number(selectedBooking.value.id)
  if (!Number.isFinite(id)) return

  decidingId.value = id
  //message.value = ''
  //error.value = ''

  try {
  console.log("Sende Entscheidung an API...", { id, decision })
    await api.put(`/approvals/${id}`, { decision })
    message.value = decision === 'approve' ? t('approvals.success.approved') : t('approvals.success.rejected')
  } catch (e) {
    detailErr.value = t('approvals.error.decide')
  } finally {
    closeDetails()
    loadBookings()
    decidingId.value = null
  }
}

const editRoomId = ref('')
const editDate = ref('')
const editStart = ref('')
const editEnd = ref('')
const editName = ref('')
const editBeschreibung = ref('')
const editParticipantQuery = ref('')
const editParticipantResults = ref([])
const editParticipantLoading = ref(false)
const editSelectedParticipants = ref([])
const showEditParticipantDropdown = ref(false)

let editSearchTimer = null
let editCurrentAbort = null

function editLabelForUser(u) {
  const name = (u?.name || '').trim()
  const email = (u?.email || '').trim()
  if (name && email) return `${name} (${email})`
  return name || email || ''
}

function editIsAlreadySelected(user) {
  const id = Number(user?.id)
  if (!Number.isFinite(id)) return false
  return editSelectedParticipants.value.some((p) => Number(p.id) === id)
}

function editAddParticipant(user) {
  if (!user || !Number.isFinite(Number(user.id))) return
  if (editIsAlreadySelected(user)) return
  editSelectedParticipants.value.push({ id: user.id, email: user.email, name: user.name })
  editParticipantQuery.value = ''
  editParticipantResults.value = []
  showEditParticipantDropdown.value = false
}

function editRemoveParticipant(id) {
  editSelectedParticipants.value = editSelectedParticipants.value.filter((p) => Number(p.id) !== Number(id))
}

async function editSearchUsers(q) {
  editParticipantLoading.value = true
  if (editCurrentAbort) editCurrentAbort.abort()
  editCurrentAbort = new AbortController()
  try {
    const params = { limit: 12 }
    if (q) params.q = q
    const res = await api.get('/users', { params, signal: editCurrentAbort.signal })
    editParticipantResults.value = Array.isArray(res.data) ? res.data : []
  } catch (e) {
    if (e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return
    editParticipantResults.value = []
  } finally {
    editParticipantLoading.value = false
  }
}

watch(editParticipantQuery, (q) => {
  if (editSearchTimer) clearTimeout(editSearchTimer)
  const query = String(q || '').trim()
  if (!query) {
    editParticipantResults.value = []
    showEditParticipantDropdown.value = false
    return
  }
  showEditParticipantDropdown.value = true
  editSearchTimer = setTimeout(() => {
    editSearchUsers(query)
  }, 250)
})

const saving = ref(false)
const deleting = ref(false)
const detailMsg = ref('')
const detailErr = ref('')
const showReapprovalModal = ref(false)

const todayIso = computed(() => toIsoDate(new Date()))

const now = ref(new Date())
const nowTimer = setInterval(() => {
  now.value = new Date()
}, 30_000)

const sortedBookings = computed(() => {
  return [...bookings.value].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.start_time.localeCompare(b.start_time)
  })
})

onUnmounted(() => {
  clearInterval(nowTimer)
  if (editSearchTimer) clearTimeout(editSearchTimer)
  if (editCurrentAbort) editCurrentAbort.abort()
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
  return b?.person || t('calendar.messages.occupied')
}

function isApprovedStatus(status) {
  return String(status || '').toLowerCase() === 'genehmigt'
}

function bookingStatusClass(b) {
  return isApprovedStatus(b?.status) ? 'is-approved' : 'is-planned'
}

function bookingStatusLabel(b) {
  return isApprovedStatus(b?.status)
    ? t('calendar.status.approved')
    : t('calendar.status.pending')
}

function openDetails(b) {
  selectedBooking.value = b
  showDetails.value = true

  // prefill edit fields (admins and creators)
  editRoomId.value = String(b?.room_id ?? '')
  editDate.value = String(b?.date ?? '')
  editStart.value = String(b?.start_time ?? '')
  editEnd.value = String(b?.end_time ?? '')
  editName.value = String(b?.name ?? '')
  editBeschreibung.value = String(b?.beschreibung ?? '')
  editSelectedParticipants.value = Array.isArray(b?.participants)
    ? b.participants.map((p) => ({ id: p.id, email: p.email, name: p.name })).filter((p) => p.email)
    : []
  editParticipantQuery.value = ''
  editParticipantResults.value = []
  showEditParticipantDropdown.value = false
  detailMsg.value = ''
  detailErr.value = ''
}

function closeDetails() {
  showDetails.value = false
  selectedBooking.value = null
	detailMsg.value = ''
	detailErr.value = ''
  editSelectedParticipants.value = []
  editParticipantQuery.value = ''
  editParticipantResults.value = []
  showEditParticipantDropdown.value = false
  if (editSearchTimer) clearTimeout(editSearchTimer)
  if (editCurrentAbort) editCurrentAbort.abort()
}

function parseEmails(text) {
  return String(text || '')
    .split(/[,;\n\r\t]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function getAxiosErrorMessage(e, fallback) {
  const status = e?.response?.status
  const apiError = e?.response?.data?.error

  if (status === 401) return apiError || t('calendar.messages.loginRequired')
  if (status === 403) return apiError || t('calendar.messages.adminRequired')
  if (status === 404) return apiError || t('calendar.messages.notFound')
  if (status === 409) return apiError || t('calendar.messages.occupied')

  return apiError || e?.message || fallback
}

async function saveBooking() {
  detailMsg.value = ''
  detailErr.value = ''

  if (!selectedBooking.value?.id) { detailErr.value = t('calendar.messages.noBookingSelected'); return }
  if (!isLoggedIn.value) { detailErr.value = t('calendar.messages.loginRequired'); return }
  if (!canEditCurrentBooking.value) { detailErr.value = t('calendar.messages.adminRequired') || 'Nur der Ersteller darf bearbeiten'; return }
  if (!editRoomId.value || !editDate.value || !editStart.value || !editEnd.value || !editName.value) {
    detailErr.value = t('calendar.messages.fillAllFields')
    return
  }
  if (editEnd.value <= editStart.value) {
    detailErr.value = t('calendar.messages.endTimeAfterStartTime')
    return
  }

  if (isApprovedStatus(selectedBooking.value.status)) {
    // Check if room or time changed
    if (
      String(selectedBooking.value.room_id) !== editRoomId.value ||
      selectedBooking.value.date !== editDate.value ||
      selectedBooking.value.start_time !== editStart.value + ':00' && selectedBooking.value.start_time !== editStart.value ||
      selectedBooking.value.end_time !== editEnd.value + ':00' && selectedBooking.value.end_time !== editEnd.value
    ) {
      showReapprovalModal.value = true
      return
    }
  }

  executeSaveBooking()
}

async function executeSaveBooking() {
  showReapprovalModal.value = false
  detailMsg.value = ''
  detailErr.value = ''
  saving.value = true
  try {
    await api.put(`/bookings/${selectedBooking.value.id}`, {
        room_id: Number(editRoomId.value),
        date: editDate.value,
        start_time: editStart.value,
        end_time: editEnd.value,
        name: editName.value,
        beschreibung: editBeschreibung.value,
        participant_emails: editSelectedParticipants.value
          .map((p) => String(p.email || '').trim())
          .filter(Boolean),
    })

    detailMsg.value = t('calendar.messages.changesSaved')
    await loadBookings()
    closeDetails()
  } catch (e) {
    detailErr.value = getAxiosErrorMessage(e, t('common.error'))
  } finally {
    saving.value = false
  }
}

async function deleteBooking() {
  detailMsg.value = ''
  detailErr.value = ''

  if (!selectedBooking.value?.id) { detailErr.value = t('calendar.messages.noBookingSelected'); return }
  if (!isLoggedIn.value) { detailErr.value = t('calendar.messages.loginRequired'); return }
  if (!canDeleteCurrentBooking.value) { detailErr.value = t('calendar.messages.deleteRequired') || 'Nur der Ersteller oder ein Genehmiger darf löschen'; return }

  const ok = window.confirm(t('calendar.messages.confirmDelete'))
  if (!ok) return

  deleting.value = true
  try {
    await api.delete(`/bookings/${selectedBooking.value.id}`)

    await loadBookings()
    closeDetails()
  } catch (e) {
    detailErr.value = getAxiosErrorMessage(e, t('calendar.messages.deleteError'))
  } finally {
    deleting.value = false
  }
}

function weekRangeQuery() {
  const from = toIsoDate(weekDays.value[0])
  const to = toIsoDate(weekDays.value[6])
  return { from, to }
}

async function loadRooms() {
  loadingRooms.value = true
  errorCalender.value = ''
  try {
    const res = await api.get(`/rooms`)
    if (!res.data) throw new Error(t('calendar.messages.loadRoomsError'))
    rooms.value = res.data
    if (!roomId.value && rooms.value.length) roomId.value = String(rooms.value[0].id)
  } catch (e) {
    errorCalender.value = e.message
  } finally {
    loadingRooms.value = false
  }
}

async function loadBookings() {
  if (!roomId.value && !onlyMine.value) {
    bookings.value = []
    return
  }

  loadingBookings.value = true
  errorCalender.value = ''
  try {
    const { from, to } = weekRangeQuery()
    let params = {
      from: from,
      to: to,
    }

    if (onlyMine.value) {
       params.mine = 'true'
    } else {
       params.room_id = roomId.value
    }

    const res = await api.get(`/bookings`, { params })
    if (!res.data) throw new Error(t('calendar.messages.loadBookingsError'))
    bookings.value = await res.data
  } catch (e) {
    errorCalender.value = e.message
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

watch([roomId, weekCursor, onlyMine], () => { loadBookings() })

onMounted(async () => {
  await loadRooms()
  await loadBookings()
})
</script>

<template>
  <section class="calendar-page">
    <div class="calendar-container">
      <div class="calendar-layout">
        <!-- Toolbar -->
        <header class="toolbar">
          <div class="toolbar-group">
            <div class="room-dropdown-wrapper">
                <button class="room-toggle-btn" type="button" @click="toggleRoomDropdown" :title="$t('calendar.selectRoom') || 'Select Room'" :disabled="loadingRooms || onlyMine">
                  <span>{{ currentRoomName }}</span>
                  <span class="dropdown-arrow">▼</span>
                </button>
                <Transition name="slide-fade">
                  <div v-show="showRoomDropdown" class="user-dropdown room-menu-dropdown">
                    <button 
                      v-for="r in rooms" 
                      :key="r.id" 
                      type="button"
                      @click="selectRoom(r.id)" 
                      class="dropdown-item room-item"
                      :class="{ 'is-active': String(r.id) === roomId }"
                    >
                       {{ r.name || r.Bezeichnung || r.bezeichnung }}
                    </button>
                  </div>
                </Transition>
            </div>
            <button class="btn btn-secondary my-calendar-btn" :class="{ 'is-active': onlyMine }" @click="toggleMyCalendar">
               {{ $t('calendar.toolbar.myCalendar') }}
            </button>
          </div>

          <div class="toolbar-center">
            <div class="week-nav">
               <button class="nav-btn" type="button" @click="prevWeek" :aria-label="$t('calendar.toolbar.prevWeek')">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
               </button>
               
               <div class="week-selector">
                 <button class="current-week-btn" type="button" @click="openWeekPicker" :title="'Woche wählen'">
                    {{ weekLabel }}
                 </button>
                 <input 
                    ref="weekPickerInput" 
                    type="date" 
                    class="hidden-date-input" 
                    tabindex="-1"
                    @change="onWeekPicked" 
                 />
               </div>

               <button class="nav-btn" type="button" @click="nextWeek" :aria-label="$t('calendar.toolbar.nextWeek')">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
               </button>
            </div>
          </div>

          <div class="toolbar-group right">
             <div class="view-toggle">
              <button class="btn btn-primary btn-booking" @click="showBookingPanel = true">
                <span>+</span> {{ $t('calendar.toolbar.booking') }}
             </button>
               <button class="toggle-btn" :class="{ active: currentView === 'calendar' }" @click="currentView = 'calendar'">{{ $t('calendar.toolbar.calendar') }}</button>
               <button class="toggle-btn" :class="{ active: currentView === 'table' }" @click="currentView = 'table'">{{ $t('calendar.toolbar.table') }}</button>
             </div>
             
          </div>
        </header>

        <div v-if="errorCalender" class="message is-errorCalender">
          <span class="icon">⚠️</span> {{ errorCalender }}
        </div>

        <!-- Calendar Grid -->
        <div v-if="currentView === 'calendar'" class="calendar-card">
           <div class="calendar-header">
              <div class="time-column-header"></div>
              <div v-for="(d, idx) in weekDays" :key="toIsoDate(d)" class="day-column-header" :class="{ 'is-today': toIsoDate(d) === todayIso }">
                 <div class="dow">{{ dayLabels[idx] }}</div>
                 <div class="dom">{{ pad2(d.getDate()) }}</div>
              </div>
           </div>

           <div class="calendar-body-scroll">
              <div class="calendar-body" :style="{ height: gridHeightPx + 'px' }">
                 <!-- Time Axis -->
                 <div class="time-column">
                    <div v-for="t in timeSlots" :key="t" class="time-tick" :style="{ height: (60 * pxPerMinute) + 'px' }">
                       <span>{{ t }}</span>
                    </div>
                 </div>

                 <!-- Days Grid -->
                 <div class="days-container">
                    <div
                      v-for="d in weekDays"
                      :key="toIsoDate(d)"
                      class="day-column"
                      :class="{ 'is-today': toIsoDate(d) === todayIso }"
                       :style="{ height: gridHeightPx + 'px', '--hour-row-height': (60 * pxPerMinute) + 'px' }"
                    >
                       <!-- Current Time Line -->
                       <div v-if="toIsoDate(d) === todayIso && showNowLine" class="now-line" :style="nowLineStyle">
                          <div class="now-dot"></div>
                       </div>

                       <!-- Bookings -->
                       <div
                         v-for="b in bookingsForDay(d)"
                         :key="b.id"
                         class="booking-item"
                         :class="bookingStatusClass(b)"
                         :style="bookingStyle(b)"
                         :title="`${b.start_time}–${b.end_time} ${bookingParticipantsLabel(b)}`.trim()"
                         role="button"
                         tabindex="0"
                         @click="openDetails(b)"
                         @keydown.enter.prevent="openDetails(b)"
                       >
                          <div class="booking-time">{{ b.start_time }} · {{ bookingStatusLabel(b) }}</div>
                          <div class="booking-title">
                             <span v-if="onlyMine && b.room" style="font-weight: bold; margin-right: 4px;">{{ b.room }}:</span>
                             {{ bookingParticipantsLabel(b) }}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <!-- Table View -->
        <div v-else class="calendar-card table-view">
           <div class="table-scroll">
              <table class="data-table">
                 <thead>
                    <tr>
                       <th>{{ $t('calendar.table.date') }}</th>
                       <th>{{ $t('calendar.table.time') }}</th>
                       <th>{{ $t('calendar.table.room') }}</th>
                        <th>{{ $t('calendar.table.status') }}</th>
                       <th>{{ $t('calendar.table.title') }}</th>
                       <th style="width: 60px"></th>
                    </tr>
                 </thead>
                 <tbody>
                    <tr v-for="b in sortedBookings" :key="b.id">
                       <td>{{ toIsoDate(b.date) }}</td>
                       <td class="whitespace-nowrap">{{ b.start_time }} – {{ b.end_time }}</td>
                       <td>
                          {{ rooms.find(r => String(r.id) === String(b.room_id))?.name || $t('calendar.table.unknownRoom') }}
                       </td>
                        <td>
                          <span class="status-badge" :class="bookingStatusClass(b)">{{ bookingStatusLabel(b) }}</span>
                        </td>
                       <td>
                          <div class="cell-title" :title="bookingParticipantsLabel(b)">{{ bookingParticipantsLabel(b) }}</div>
                       </td>
                       <td style="text-align: right;">
                          <button class="btn-icon" @click="openDetails(b)" title="Bearbeiten/Details">✏️</button>
                       </td>
                    </tr>
                    <tr v-if="sortedBookings.length === 0">
                        <td colspan="6" class="empty-state">{{ $t('calendar.table.empty') }}</td>
                    </tr>
                 </tbody>
              </table>
           </div>
        </div>
      </div>
      
      <!-- Side Panel for Booking -->
      <aside v-if="showBookingPanel" class="booking-sidebar">
         <BookingForm 
            :rooms="rooms"
            @close="showBookingPanel = false"
            @booking-created="() => { loadBookings(); showBookingPanel = false; }"
         />
      </aside>
    </div>

    <!-- Booking Details Modal -->
    <Teleport to="body">
      <div v-if="showDetails" class="modal-backdrop" @click.self="closeDetails">
         <div class="modal" role="dialog" aria-modal="true">
            <header class="modal-header">
               <h2 class="modal-title">{{ $t('calendar.modal.title') }}</h2>
               <button class="close-btn" type="button" @click="closeDetails" :aria-label="$t('calendar.modal.close')">✕</button>
            </header>

            <div v-if="selectedBooking" class="modal-body">
              <div class="status-row">
                <span class="label">{{ $t('calendar.modal.status') }}</span>
                <span class="status-badge" :class="bookingStatusClass(selectedBooking)">{{ bookingStatusLabel(selectedBooking) }}</span>
              </div>

               <template v-if="canEditCurrentBooking">
                  <div class="form-group">
                     <label for="edit-room-id" class="form-label">{{ $t('calendar.modal.room') }}</label>
                     <div class="select-wrapper">
                        <select id="edit-room-id" v-model="editRoomId" class="form-input">
                           <option v-for="r in rooms" :key="r.id" :value="String(r.id)">
                              {{ r.name || r.Bezeichnung || r.bezeichnung }}
                           </option>
                        </select>
                        <span class="select-arrow">▼</span>
                     </div>
                  </div>
                  <div class="form-row">
                     <div class="form-group">
                        <label for="edit-date" class="form-label">{{ $t('calendar.modal.date') }}</label>
                        <input id="edit-date" v-model="editDate" class="form-input" type="date" />
                     </div>
                     <div class="form-group">
                        <label for="edit-start" class="form-label">{{ $t('calendar.modal.start') }}</label>
                        <input id="edit-start" v-model="editStart" class="form-input" type="time" />
                     </div>
                     <div class="form-group">
                        <label for="edit-end" class="form-label">{{ $t('calendar.modal.end') }}</label>
                        <input id="edit-end" v-model="editEnd" class="form-input" type="time" />
                     </div>
                  </div>
                  <div class="form-group">
                     <label for="edit-name" class="form-label">{{ $t('bookingForm.nameTitle') }}</label>
                     <input id="edit-name" v-model="editName" class="form-input" type="text" :placeholder="$t('bookingForm.namePlaceholder')" />
                  </div>
                  <div class="form-group">
                     <label for="edit-desc" class="form-label">{{ $t('bookingForm.description') }}</label>
                     <textarea id="edit-desc" v-model="editBeschreibung" class="form-input" rows="2" :placeholder="$t('bookingForm.descriptionPlaceholder')"></textarea>
                  </div>
                  <div class="form-group edit-participant-section">
                     <label for="edit-parts" class="form-label">{{ $t('calendar.modal.participants') }}</label>
                     <div class="edit-search-wrapper">
                        <input
                           id="edit-parts"
                           v-model="editParticipantQuery"
                           class="form-input"
                           type="text"
                           :placeholder="$t('bookingForm.searchPlaceholder')"
                           @focus="showEditParticipantDropdown = !!editParticipantQuery"
                        />
                        <div v-if="editParticipantLoading" class="edit-spinner-sm"></div>
                     </div>
                     <div v-if="showEditParticipantDropdown && editParticipantResults.length && editParticipantQuery" class="edit-search-dropdown">
                        <button
                           type="button"
                           v-for="u in editParticipantResults"
                           :key="u.id"
                           class="edit-dropdown-item"
                           @click="editAddParticipant(u)"
                        >
                           <div class="edit-avatar-sm">{{ (u.name?.[0] || u.email?.[0] || '?').toUpperCase() }}</div>
                           <div class="edit-user-info">
                              <div class="edit-user-name">{{ u.name || 'Unbekannt' }}</div>
                              <div class="edit-user-email">{{ u.email }}</div>
                           </div>
                           <div v-if="editIsAlreadySelected(u)" class="edit-already-badge">✓</div>
                        </button>
                     </div>
                     <div v-else-if="showEditParticipantDropdown && editParticipantQuery && !editParticipantLoading" class="edit-search-dropdown edit-empty">
                        {{ $t('bookingForm.noResults') }}
                     </div>
                     <div v-if="editSelectedParticipants.length" class="edit-selected-list">
                        <div v-for="p in editSelectedParticipants" :key="p.id" class="edit-chip">
                           <span class="edit-chip-label">{{ p.name || p.email }}</span>
                           <button type="button" class="edit-chip-remove" @click="editRemoveParticipant(p.id)">✕</button>
                        </div>
                     </div>
                  </div>

                  <div class="modal-actions">
                     <button class="btn btn-primary" type="button" :disabled="saving || deleting" @click="saveBooking">
                        {{ saving ? $t('calendar.modal.saving') : $t('calendar.modal.save') }}
                     </button>
                     <button class="btn btn-text text-danger" type="button" :disabled="saving || deleting" @click="deleteBooking">
                        {{ deleting ? $t('calendar.modal.deleting') : $t('calendar.modal.delete') }}
                     </button>
                  </div>
               </template>

               <template v-else>
                  <div class="detail-list">
                     <div class="detail-item">
                        <span class="label">{{ $t('calendar.modal.room') }}</span>
                        <span class="value">{{ selectedBooking.room || rooms.find(r => String(r.id) === String(selectedBooking.room_id))?.name || '---' }}</span>
                     </div>
                     <div class="detail-item">
                        <span class="label">Name</span>
                        <span class="value">{{ selectedBooking.name || '---' }}</span>
                     </div>
                     <div class="detail-item" v-if="selectedBooking.beschreibung">
                        <span class="label">Beschreibung</span>
                        <span class="value">{{ selectedBooking.beschreibung }}</span>
                     </div>
                     <div class="detail-item">
                        <span class="label">{{ $t('calendar.modal.timeRange') }}</span>
                        <span class="value">{{ toIsoDate(selectedBooking.date) }} <br> {{ selectedBooking.start_time }} – {{ selectedBooking.end_time }}</span>
                     </div>
                  </div>
                  
                  <div class="modal-actions" v-if="canDeleteCurrentBooking && !canEditCurrentBooking && !isApprovedStatus(selectedBooking.status)">
                  <button
                    class="icon-btn reject"
                    type="button"
                    @click="decideApproval('reject')"
                    :title="$t('approvals.reject')"
                  >
                    X
                  </button>
                  <button
                    class="icon-btn approve"
                    type="button"
                    @click="decideApproval('approve')"
                    :title="$t('approvals.approve')"
                  >
                    ✓
                  </button>
                  </div>

                <div v-else-if="canDeleteCurrentBooking && isApprovedStatus(selectedBooking.status)" class="pending-approval">
                     <button class="btn btn-text text-danger" type="button" :disabled="saving || deleting" @click="deleteBooking">
                        {{ deleting ? $t('calendar.modal.deleting') : $t('calendar.modal.delete') }}
                     </button>
                  </div>
               </template>

               <div class="detail-section">
                  <h3>{{ $t('calendar.modal.participantsList') }}</h3>
                  <ul v-if="Array.isArray(selectedBooking.participants) && selectedBooking.participants.length" class="participant-list">
                     <li v-for="p in selectedBooking.participants" :key="p.id">
                        <div class="participant-avatar">{{ (p.name?.[0] || p.email?.[0] || '?').toUpperCase() }}</div>
                        <span class="participant-name">{{ p.name || p.email }}</span>
                     </li>
                  </ul>
                  <p v-else class="text-muted">{{ $t('calendar.modal.noParticipants') }}</p>
               </div>

               <div v-if="detailMsg" class="message is-success">{{ detailMsg }}</div>
            </div>
         </div>
      </div>
    </Teleport>

    <!-- Error Selection Modal -->
    <Teleport to="body">
      <div v-if="detailErr" class="modal-backdrop" style="z-index: 10001;" @click.self="detailErr = ''">
        <div class="modal error-modal" role="dialog" aria-modal="true">
          <header class="modal-header">
            <h2 class="modal-title">{{ $t('common.error') || 'Fehler' }}</h2>
            <button class="close-btn" type="button" @click="detailErr = ''" :aria-label="$t('calendar.modal.close') || 'Schließen'">✕</button>
          </header>

          <div class="modal-body">
            <div class="message is-error" style="text-align: center; font-weight: 500; font-size: 1.1rem; border: none; background: transparent; color: var(--color-danger);">
              {{ detailErr }}
            </div>
          </div>

          <div class="modal-actions" style="display: flex; justify-content: flex-end; padding: var(--space-4); border-top: 1px solid var(--color-border); background: var(--color-bg-secondary); border-radius: 0 0 var(--radius-xl) var(--radius-xl);">
            <button class="btn btn-secondary" type="button" @click="detailErr = ''">OK</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Re-approval Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showReapprovalModal" class="modal-backdrop" @click.self="showReapprovalModal = false">
         <div class="modal error-modal" role="dialog" aria-modal="true">
            <header class="modal-header">
               <h2 class="modal-title">Achtung: Erneute Genehmigung erforderlich</h2>
               <button class="close-btn" type="button" @click="showReapprovalModal = false" :aria-label="$t('calendar.modal.close') || 'Schließen'">✕</button>
            </header>

            <div class="modal-body">
               <p style="margin-bottom: var(--space-4);">
                 Du hast Änderungen an Raum, Datum oder Uhrzeit vorgenommen. <br><br>
                 Da dieses Meeting bereits <strong>genehmigt</strong> war, führt die Speicherung dazu, dass der Status wieder auf <strong>"Geplant"</strong> zurückgesetzt wird und das Meeting neu genehmigt werden muss.
               </p>
               <p style="font-weight: bold; color: var(--color-danger);">
                 Möchtest du diese Änderungen trotzdem speichern?
               </p>
            </div>

            <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4); border-top: 1px solid var(--color-border); background: var(--color-bg-secondary); border-radius: 0 0 var(--radius-xl) var(--radius-xl);">
               <button class="btn btn-secondary" type="button" @click="showReapprovalModal = false">Abbrechen</button>
               <button class="btn btn-primary" type="button" @click="executeSaveBooking">Trotzdem speichern</button>
            </div>
         </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.calendar-page {
  /* Height managed by flex layout in App */
  display: flex;
  flex-direction: column;
  flex: 1;
}

.calendar-container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 var(--space-6) var(--space-6);
  flex: 1;
  display: flex;
  flex-direction: row; /* Change to row to support sidebar */
  gap: var(--space-6);
}

.calendar-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: var(--space-6);
  flex: 1;
}

/* Sidebar for Booking */
.booking-sidebar {
  width: 350px;
  background-color: var(--color-bg-surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--color-border);
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Toolbar */
.toolbar {
  margin-top: 23px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
  flex-wrap: wrap;
  gap: var(--space-4);
  background: var(--color-bg-surface);
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
  border: 1px solid var(--color-border);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.select-wrapper {
  position: relative;
  display: inline-block;
}
.room-dropdown-wrapper {
  position: relative;
  min-width: 240px;
}

.my-calendar-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  font-weight: 600;
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  height: 44px; /* Match room-toggle-btn height approximately */
}

.my-calendar-btn:hover {
  background-color: var(--color-bg-accent);
}

.my-calendar-btn.is-active {
  background-color: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.room-toggle-btn {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: 1.1rem;
  padding: 0.6rem 1rem;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.room-toggle-btn:hover {
  background-color: var(--color-bg-accent);
}

.room-toggle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dropdown-arrow {
  margin-left: 1rem;
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  transform: translateY(1px);
}

.room-menu-dropdown {
  position: absolute;
  top: 110%;
  left: 0;
  width: 100%;
  background-color: var(--color-bg-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-2);
  z-index: 2000;
  max-height: 300px;
  overflow-y: auto;
}

.room-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: var(--space-3);
  background: none;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 500;
  color: var(--color-text-primary);
  transition: all 0.2s;
}

.room-item:hover, .room-item.is-active {
  background-color: var(--color-bg-accent);
  color: var(--color-primary);
}

.select-arrow {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 0.7rem;
  color: var(--color-text-secondary);
}

.week-nav {
  display: flex;
  align-items: center;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  padding: 4px;
  border: 1px solid transparent;
   gap: var(--space-2);
}

.week-selector {
  position: relative;
  display: flex;
  align-items: center;
}

.hidden-date-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
  border: 0;
}

.current-week-btn {
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: 0.95rem;
  padding: 0.4rem 1rem;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.current-week-btn:hover {
  background-color: var(--color-bg-accent);
  color: var(--color-primary);
}

.nav-btn {
  border: 1px solid transparent;
}

.nav-btn {
  background: none;
  border: none;
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.nav-btn:hover {
  background-color: var(--color-bg-surface);
  color: var(--color-primary);
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.today-btn {
  font-size: 0.9rem;
}

.current-week-label {
  font-weight: 600;
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
}

.btn-booking {
  border-radius: var(--radius-full);
  padding: 0.6rem 1.5rem;
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.message.is-errorCalender {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-weight: 500;
}

/* Calendar Card */
.calendar-card {
  flex: 1;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  min-height: 600px;
}

.calendar-header {
  display: grid;
  grid-template-columns: 70px repeat(7, minmax(0, 1fr));
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-secondary);
}

.time-column-header {
  width: 70px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
}

.day-column-header {
  min-width: 0;
  text-align: center;
  padding: var(--space-3) var(--space-2);
  border-right: 1px solid var(--color-border);
}

.day-column-header:last-child {
  border-right: none;
}

.day-column-header.is-today {
  background-color: var(--color-primary-light);
}

.day-column-header.is-today .dow {
  color: var(--color-primary);
}
.day-column-header.is-today .dom {
  color: var(--color-primary);
  font-weight: 700;
}

.dow {
  font-size: 0.8rem;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  font-weight: 700;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.dom {
  font-size: 1.5rem;
  font-weight: 300;
  line-height: 1;
}

.calendar-body-scroll {
  flex: 1;
  overflow-y: auto;
  position: relative;
  scrollbar-width: thin;
}

.calendar-body {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr);
  position: relative;
}

.time-column {
  width: 70px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background-color: var(--color-bg-secondary);
  position: sticky;
  left: 0;
  z-index: 30;
}

.time-tick {
  border-bottom: 1px solid transparent; /* Spacer */
  position: relative;
}

.time-tick span {
  position: absolute;
  top: 6px;
  left: 0;
  width: 100%;
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.days-container {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  position: relative;
}

.day-column {
  position: relative;
  border-right: 1px solid var(--color-border);
  min-width: 0;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent calc(var(--hour-row-height) - 1px),
    var(--color-border) calc(var(--hour-row-height) - 1px),
    var(--color-border) var(--hour-row-height)
  );
  background-repeat: repeat-y;
  background-size: 100% var(--hour-row-height);
}

.day-column:last-child {
  border-right: none;
}

/* Now Line */
.now-line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 2px solid var(--color-danger);
  z-index: 10;
  pointer-events: none;
}

.now-dot {
  position: absolute;
  left: -6px;
  top: -6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--color-danger);
  box-shadow: 0 0 0 2px white;
}

/* Bookings */
.booking-item {
  position: absolute;
  color: #111827;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.8rem;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  z-index: 5;
}

.booking-item.is-planned {
  background-color: #f59e0b;
  border: 1px solid rgba(146, 64, 14, 0.25);
}

.booking-item.is-approved {
  background-color: #16a34a;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.booking-item:hover {
  transform: scale(1.02);
  z-index: 20;
  box-shadow: 0 8px 16px rgba(0,0,0,0.15);
}

.booking-time {
  font-weight: 800;
  font-size: 0.75rem;
  margin-bottom: 2px;
  opacity: 0.9;
}

.booking-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: var(--space-4);
  animation: fadeIn 0.2s ease-out;
}

.error-modal {
  max-width: 400px;
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  flex-direction: column;
}

.modal {
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 500px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  padding: var(--space-6);
  border-bottom: 1px solid rgba(0,0,0,0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0;
}

.close-btn {
  background: var(--color-bg-secondary);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.close-btn:hover {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
}

.modal-body {
  padding: var(--space-6);
  overflow-y: auto;
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 700;
}

.status-badge.is-planned {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}

.status-badge.is-approved {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.detail-item {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-3);
  align-items: center;
}
.detail-item .label {
  color: var(--color-text-secondary);
  font-weight: 500;
}
.detail-item .value {
  font-weight: 600;
  text-align: right;
}

.detail-section {
  margin-top: var(--space-6);
}
.detail-section h3 {
  font-size: 1rem;
  margin-bottom: var(--space-3);
  color: var(--color-text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.participant-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.participant-list li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  background: var(--color-bg-accent);
  border-radius: var(--radius-lg);
}

.participant-avatar {
  width: 28px;
  height: 28px;
  background-color: var(--color-bg-primary);
  color: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.8rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.participant-name {
  font-weight: 500;
  font-size: 0.95rem;
}

.modal-actions {
  margin-top: var(--space-8);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-text {
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}
.text-danger {
  color: var(--color-danger);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-4);
}

.form-group {
  margin-bottom: var(--space-4);
}
.form-label {
  display: block;
  font-weight: 600;
  margin-bottom: var(--space-2);
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}
.form-input {
  width: 100%;
  padding: 0.6rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: inherit;
  transition: all 0.2s;
}
.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

textarea.form-input {
  resize: vertical;
}

.font-mono {
  font-family: monospace;
  font-size: 0.9rem;
}

.form-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  display: block;
  margin-top: var(--space-1);
}

/* View Toggle */
.view-toggle {
  display: flex;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  padding: 4px;
  gap: 2px;
}

.toggle-btn {
  background: none;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: var(--radius-full);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  color: var(--color-text-primary);
}

.toggle-btn.active {
  background-color: var(--color-bg-surface);
  color: var(--color-primary);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

/* Table View */
.table-view {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-surface);
}

.table-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.data-table th, .data-table td {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.data-table th {
  position: sticky;
  top: 0;
  background-color: var(--color-bg-secondary);
  font-weight: 700;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  z-index: 10;
}

.data-table tr:last-child td {
  border-bottom: none;
}

.data-table tr:hover td {
  background-color: var(--color-bg-accent);
}

.whitespace-nowrap {
  white-space: nowrap;
}

.cell-title {
  font-weight: 500;
  color: var(--color-text-primary);
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-text-muted);
  font-style: italic;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 4px;
  border-radius: 4px;
  opacity: 0.6;
  transition: all 0.2s;
}
.btn-icon:hover {
  opacity: 1;
  background-color: var(--color-bg-secondary);
}

/* Edit Participant Dropdown */
.edit-participant-section {
  position: relative;
  min-width: 0;
}
.edit-search-wrapper {
  position: relative;
}
.edit-search-dropdown {
  position: absolute;
  top: 100%; left: 0; right: 0;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  z-index: 50;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 4px;
}
.edit-dropdown-item {
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-radius: 0;
  font-family: inherit;
  color: inherit;
  font-size: 1rem;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-bg-secondary);
}
.edit-dropdown-item:last-child { border-bottom: none; }
.edit-dropdown-item:hover { background-color: var(--color-bg-accent); }
.edit-empty { padding: 12px; color: var(--color-text-muted); font-size: 0.9rem; text-align: center; }

.edit-avatar-sm {
  width: 32px; height: 32px;
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.8rem;
  flex-shrink: 0;
}
.edit-user-info { flex: 1; min-width: 0; }
.edit-user-name { font-weight: 500; font-size: 0.9rem; }
.edit-user-email { font-size: 0.8rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.edit-already-badge { color: var(--color-success); font-weight: bold; }

.edit-selected-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.edit-chip {
  background: var(--color-bg-accent);
  padding: 4px 8px;
  border-radius: 16px;
  display: flex; align-items: center; gap: 6px;
  font-size: 0.85rem;
}
.edit-chip-remove {
  background: none; border: none; cursor: pointer;
  color: var(--color-text-muted); font-size: 1rem;
  padding: 0; line-height: 1;
}
.edit-chip-remove:hover { color: var(--color-danger); }

.edit-spinner-sm {
  position: absolute; right: 10px; top: 10px;
  width: 16px; height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: edit-spin 0.6s linear infinite;
}
@keyframes edit-spin { to { transform: rotate(360deg); } }
</style>


