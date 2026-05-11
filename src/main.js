// Dimensions config
const DIMS = {
  uti: {
    photo: { w: 213, h: 213, dpi: 300, label: '213 \u00D7 213 px', maxKB: 30 },
    sig: { w: 400, h: 200, dpi: 600, label: '400 \u00D7 200 px', maxKB: 60, bw: true },
  },
  nsdl: {
    photo: { w: 276, h: 197, dpi: 200, label: '3.5 \u00D7 2.5 cm', maxKB: 50 },
    sig: { w: 354, h: 79, dpi: 200, label: '4.5 \u00D7 2.0 cm', maxKB: 50, bw: false },
  },
}

let currentPortal = 'uti'
let photoFile = null
let sigFile = null
let photoResizedBlob = null
let sigResizedBlob = null

// --- DOM ---
const portalBtns = document.querySelectorAll('.portal-btn')
const photoInput = document.getElementById('photoInput')
const sigInput = document.getElementById('sigInput')
const photoBox = document.getElementById('photoBox')
const sigBox = document.getElementById('sigBox')
const photoPreview = document.getElementById('photoPreview')
const sigPreview = document.getElementById('sigPreview')
const photoResizeBtn = document.getElementById('photoResizeBtn')
const sigResizeBtn = document.getElementById('sigResizeBtn')
const photoDownloadBtn = document.getElementById('photoDownloadBtn')
const sigDownloadBtn = document.getElementById('sigDownloadBtn')
const photoStatus = document.getElementById('photoStatus')
const sigStatus = document.getElementById('sigStatus')
const portalStatus = document.getElementById('portalStatus')
const photoColSpecs = document.getElementById('photoColSpecs')
const sigColSpecs = document.getElementById('sigColSpecs')
const photoSpecs = document.getElementById('photoSpecs')
const sigSpecs = document.getElementById('sigSpecs')
const photoBadge = document.getElementById('photoBadge')
const sigBadge = document.getElementById('sigBadge')

// --- Helpers ---
function fmt(n) {
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(1) + ' MB'
}

function resizeImage(file, w, h, bw, cb) {
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    const sr = img.naturalWidth / img.naturalHeight
    const dr = w / h
    let sx, sy, sw, sh
    if (sr > dr) { sh = img.naturalHeight; sw = img.naturalHeight * dr; sx = (img.naturalWidth - sw) / 2; sy = 0 }
    else { sw = img.naturalWidth; sh = img.naturalWidth / dr; sx = 0; sy = (img.naturalHeight - sh) / 2 }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
    if (bw) {
      const d = ctx.getImageData(0, 0, w, h)
      for (let i = 0; i < d.data.length; i += 4) {
        const g = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]
        d.data[i] = d.data[i + 1] = d.data[i + 2] = g > 128 ? 255 : 0
      }
      ctx.putImageData(d, 0, 0)
    }
    cb(c)
  }
  img.src = URL.createObjectURL(file)
}

function dl(blob, name) {
  if (!blob) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name + '.jpg'
  a.click()
}

function updateSpecs(p) {
  const d = DIMS[p]
  photoSpecs.innerHTML = (p === 'uti'
    ? ['213 x 213 px', '300 DPI', 'Max 30KB', 'JPEG Format']
    : ['3.5 x 2.5 cm (276 x 197 px)', '200 DPI', 'Max 50KB', 'JPEG Format']
  ).map(t => `<li class="flex items-center gap-2 text-slate-600"><span class="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0"></span>${t}</li>`).join('')

  sigSpecs.innerHTML = (p === 'uti'
    ? ['600 DPI', 'Max 60KB', 'B&amp;W', 'JPEG Format']
    : ['200 DPI', 'Max 50KB', 'Color', 'JPEG Format']
  ).map(t => `<li class="flex items-center gap-2 text-slate-600"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>${t}</li>`).join('')

  photoColSpecs.innerHTML = `<span class="px-2.5 py-1 rounded-md bg-teal-50 text-teal-700 font-medium text-xs">${d.photo.label}</span><span class="px-2.5 py-1 rounded-md bg-teal-50 text-teal-700 font-medium text-xs">${d.photo.dpi} DPI</span><span class="px-2.5 py-1 rounded-md bg-teal-50 text-teal-700 font-medium text-xs">&lt; ${d.photo.maxKB} KB</span>`
  sigColSpecs.innerHTML = `<span class="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-medium text-xs">${d.sig.dpi} DPI</span><span class="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-medium text-xs">&lt; ${d.sig.maxKB} KB</span><span class="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-medium text-xs">${d.sig.bw ? 'B&amp;W' : 'Color'}</span>`

  portalStatus.textContent = p.toUpperCase()
}

// --- Portal switch ---
portalBtns.forEach(b => b.addEventListener('click', () => {
  portalBtns.forEach(x => x.classList.remove('active'))
  b.classList.add('active')
  currentPortal = b.dataset.portal
  updateSpecs(currentPortal)
  document.querySelectorAll('.spec-card-3d').forEach(el => { el.style.animation = 'none'; void el.offsetHeight })
  if (photoFile) processPhoto()
  if (sigFile) processSig()
}))

// --- Upload helpers ---
function handlePhoto(f) {
  if (!f || !f.type.startsWith('image/')) return
  photoFile = f
  const r = new FileReader()
  r.onload = e => { photoPreview.src = e.target.result; photoBox.classList.add('has-image'); photoStatus.innerHTML = `<span class="text-slate-500">${f.name}</span> <span class="text-slate-400 text-xs">(${fmt(f.size)})</span>`; photoResizeBtn.disabled = false }
  r.readAsDataURL(f)
}

function handleSig(f) {
  if (!f || !f.type.startsWith('image/')) return
  sigFile = f
  const r = new FileReader()
  r.onload = e => { sigPreview.src = e.target.result; sigBox.classList.add('has-image'); sigStatus.innerHTML = `<span class="text-slate-500">${f.name}</span> <span class="text-slate-400 text-xs">(${fmt(f.size)})</span>`; sigResizeBtn.disabled = false }
  r.readAsDataURL(f)
}

photoInput.addEventListener('change', e => { if (e.target.files.length) handlePhoto(e.target.files[0]) })
sigInput.addEventListener('change', e => { if (e.target.files.length) handleSig(e.target.files[0]) })

// Drag & drop
;[{ el: photoBox, input: photoInput, fn: handlePhoto }, { el: sigBox, input: sigInput, fn: handleSig }].forEach(({ el, input, fn }) => {
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover') })
  el.addEventListener('dragleave', () => el.classList.remove('dragover'))
  el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('dragover'); if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; fn(e.dataTransfer.files[0]) } })
})

// --- Process ---
function processPhoto() {
  if (!photoFile) return
  const d = DIMS[currentPortal].photo
  photoResizeBtn.disabled = true; photoResizeBtn.innerHTML = '<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Processing...'
  resizeImage(photoFile, d.w, d.h, false, c => {
    c.toBlob(b => {
      photoResizedBlob = b
      photoPreview.src = URL.createObjectURL(b)
      photoStatus.innerHTML = `<span class="text-teal-600 font-medium">Resized</span> <span class="text-slate-500 text-xs">${d.w}\u00D7${d.h} &middot; ${fmt(b.size)}</span>`
      photoDownloadBtn.disabled = false
      photoBadge.textContent = d.w + '\u00D7' + d.h
      photoResizeBtn.disabled = false; photoResizeBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Resize Photo'
    }, 'image/jpeg', 0.85)
  })
}

function processSig() {
  if (!sigFile) return
  const d = DIMS[currentPortal].sig
  sigResizeBtn.disabled = true; sigResizeBtn.innerHTML = '<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Processing...'
  resizeImage(sigFile, d.w, d.h, d.bw, c => {
    c.toBlob(b => {
      sigResizedBlob = b
      sigPreview.src = URL.createObjectURL(b)
      sigStatus.innerHTML = `<span class="text-amber-600 font-medium">Resized</span> <span class="text-slate-500 text-xs">${d.w}\u00D7${d.h} &middot; ${fmt(b.size)}</span>`
      sigDownloadBtn.disabled = false
      sigBadge.textContent = d.w + '\u00D7' + d.h
      sigResizeBtn.disabled = false; sigResizeBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Resize Signature'
    }, 'image/jpeg', 0.85)
  })
}

photoResizeBtn.addEventListener('click', processPhoto)
sigResizeBtn.addEventListener('click', processSig)
photoDownloadBtn.addEventListener('click', () => dl(photoResizedBlob, currentPortal.toUpperCase() + '_PAN_Photo'))
sigDownloadBtn.addEventListener('click', () => dl(sigResizedBlob, currentPortal.toUpperCase() + '_PAN_Signature'))

// --- 3D tilt ---
document.querySelectorAll('.tilt-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    const cx = r.width / 2, cy = r.height / 2
    const rotX = ((y - cy) / cy) * -6, rotY = ((x - cx) / cx) * 6
    card.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-2px)`
  })
  card.addEventListener('mouseleave', () => { card.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) translateY(0px)' })
})

// Init
updateSpecs('uti')
