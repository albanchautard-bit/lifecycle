// js/script.js
// Main app: loads data.json + site-mapping.json and renders timeline table
// Author: refactored from the original single-file HTML

// -------------------- Configuration --------------------
const config = {
  // timeline bounding box
  startDate: new Date('2025-01-01'),
  endDate: new Date('2031-12-31'),
  get totalDays() {
    return (this.endDate - this.startDate) / (1000 * 60 * 60 * 24);
  }
};

// -------------------- Utilities --------------------
const parseDate = (dateString) =>
  dateString && !dateString.toString().includes('Not yet') ? new Date(dateString) : null;

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : null;

const calculateWidth = (startDate, endDate) =>
  ((endDate - startDate) / (1000 * 60 * 60 * 24) / config.totalDays) * 100;

const createTimelineBarHTML = (type, width, tooltip) =>
  `<div class="timeline-bar ${type}" style="width: ${width}%" data-tooltip="${tooltip}"></div>`;

// Determine support status for counters & filters
const getSupportStatus = (component) => {
  const now = new Date();
  const standardEnd = parseDate(component.endOfStandardSupport);
  const extendedEnd = parseDate(component.endOfExtendedSupport);

  // If extended support not announced, treat as supported (per original logic)
  if (!component.endOfExtendedSupport || component.endOfExtendedSupport.toString().includes('Not yet')) {
    return 'supported';
  }

  if (standardEnd && standardEnd > now) return 'supported';

  if (!standardEnd && extendedEnd) {
    return extendedEnd > now ? 'extended' : 'unsupported';
  }

  if (extendedEnd && extendedEnd > now) return 'extended';

  return 'unsupported';
};

// Build timeline HTML for a component
const createTimeline = (component) => {
  const { endOfStandardSupport, endOfExtendedSupport } = component;
  const isNotAnnounced = !endOfExtendedSupport || endOfExtendedSupport.toString().includes('Not yet');

  if (isNotAnnounced) {
    return createTimelineBarHTML('standard-support', 100, 'End of Standard Support is not yet announced');
  }

  const standardEnd = parseDate(endOfStandardSupport);
  const extendedEnd = parseDate(endOfExtendedSupport);

  let timeline = '';
  let currentDate = config.startDate;

  if (standardEnd && standardEnd > config.startDate) {
    const w = calculateWidth(currentDate, standardEnd);
    timeline += createTimelineBarHTML('standard-support', w, `Standard Support: until ${formatDate(endOfStandardSupport)}`);
    currentDate = standardEnd;
  } else if (!standardEnd && extendedEnd) {
    timeline += createTimelineBarHTML('standard-support', 0, 'End of Standard Support is not yet announced');
  } else if (!standardEnd && !extendedEnd) {
    return createTimelineBarHTML('standard-support', 100, 'End of Standard Support is not yet announced');
  }

  if (extendedEnd && extendedEnd > currentDate) {
    const w = calculateWidth(currentDate, extendedEnd);
    timeline += createTimelineBarHTML('extended-support', w, `Extended Support: ${formatDate(currentDate)} - ${formatDate(endOfExtendedSupport)}`);
    currentDate = extendedEnd;
  }

  if (currentDate < config.endDate) {
    const w = calculateWidth(currentDate, config.endDate);
    timeline += createTimelineBarHTML('end-of-support', w, `Out of Support after ${formatDate(currentDate)}`);
  }

  return timeline;
};

// -------------------- Data helpers --------------------
// Flatten all sections components into array with section key
const flattenAllComponents = (data) => {
  const all = [];
  Object.keys(data).forEach(k => {
    if (data[k] && Array.isArray(data[k].components)) {
      data[k].components.forEach(c => all.push({ ...c, section: k }));
    }
  });
  return all;
};

// Return components for a specific site (siteMapping contains ids)
const getAllComponentsForSite = (site, data, siteMapping) => {
  if (site === 'all') return flattenAllComponents(data);

  const siteComponents = [];
  const mapping = siteMapping[site];
  if (!mapping) return [];

  Object.keys(mapping).forEach(sectionKey => {
    const ids = mapping[sectionKey] || [];
    const sectionComponents = data[sectionKey]?.components || [];
    sectionComponents.forEach(comp => {
      if (ids.includes(comp.id)) siteComponents.push({ ...comp, section: sectionKey });
    });
  });

  return siteComponents;
};

// -------------------- Rendering --------------------
const renderTable = (data, siteMapping, section, filter = 'all', site = 'all') => {
  const tableBody = document.querySelector('tbody');

  let components;
  if (site === 'all') {
    components = data[section]?.components || [];
  } else {
    const allSiteComps = getAllComponentsForSite(site, data, siteMapping);
    components = allSiteComps.filter(c => c.section === section);
  }

  if (!components || components.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#666;">No components found for the selected filters</td></tr>';
    // zero counters
    document.querySelectorAll('.legend-btn').forEach(btn => {
      const counter = btn.querySelector('.legend-counter');
      if (counter) counter.textContent = '0';
    });
    return;
  }

  const counts = { all: components.length, supported: 0, extended: 0, unsupported: 0 };
  components.forEach(comp => counts[getSupportStatus(comp)]++);

  // update counters
  document.querySelectorAll('.legend-btn').forEach(btn => {
    const t = btn.dataset.filter;
    const counter = counts[t] || 0;
    const el = btn.querySelector('.legend-counter');
    if (el) el.textContent = counter;
  });

  // apply filter
  const filteredComponents = components.filter(comp => filter === 'all' ? true : getSupportStatus(comp) === filter);

  // group by category/subcategory
  const grouped = filteredComponents.reduce((acc, comp) => {
    const cat = comp.category || comp.subCategory || 'Unknown';
    (acc[cat] = acc[cat] || []).push(comp);
    return acc;
  }, {});

  tableBody.innerHTML = Object.entries(grouped)
    .filter(([_, items]) => items.length > 0)
    .map(([category, items], idx) => {
      const bgClass = idx % 2 === 0 ? 'category-even' : 'category-odd';
      return `
        <tr class="category-title-row"><td colspan="5">${category}</td></tr>
        ${items.map(comp => `
          <tr class="${bgClass}">
            <td>${comp.component || ''}</td>
            <td>${comp.type || ''}</td>
            <td>${comp.location || ''}</td>
            <td>${comp.model || ''}</td>
            <td class="timeline-cell">
              <div class="timeline-bar-wrapper">
                <div class="timeline-bar-container">
                  ${createTimeline(comp)}
                </div>
              </div>
            </td>
          </tr>
        `).join('')}
      `;
    }).join('');

  attachTooltipListeners();
};

// -------------------- Tooltip --------------------
const updateTooltipPosition = (e, tooltip) => {
  const { offsetWidth: width, offsetHeight: height } = tooltip;
  const padding = 15;
  let left = e.clientX + padding;
  let top = e.clientY - height / 2;

  if (left + width > window.innerWidth) left = e.clientX - width - padding;
  if (top < 0) top = padding;
  if (top + height > window.innerHeight) top = window.innerHeight - height - padding;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
};

const attachTooltipListeners = () => {
  const tooltip = document.getElementById('tooltip');
  tooltip.style.display = 'none';
  document.querySelectorAll('.timeline-bar').forEach(bar => {
    bar.addEventListener('mouseenter', (e) => {
      const text = bar.getAttribute('data-tooltip');
      if (text) {
        tooltip.textContent = text;
        tooltip.style.display = 'block';
        updateTooltipPosition(e, tooltip);
      }
    });
    bar.addEventListener('mousemove', (e) => updateTooltipPosition(e, tooltip));
    bar.addEventListener('mouseleave', () => tooltip.style.display = 'none');
  });
};

// -------------------- Dropdown / UI wiring --------------------
const populateSiteDropdown = (siteMapping) => {
  const dropdown = document.getElementById('siteDropdownMenu');
  let html = '<div class="dropdown-item active" data-site="all">All Sites</div>';
  Object.keys(siteMapping).forEach(site => {
    html += `<div class="dropdown-item" data-site="${site}">${site}</div>`;
  });
  dropdown.innerHTML = html;

  document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', function () {
      document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
      this.classList.add('active');

      const selectedSite = this.dataset.site;
      const dropdownBtn = document.getElementById('siteDropdown');
      dropdownBtn.innerHTML = selectedSite === 'all' ? 'Sites <span class="dropdown-arrow">▼</span>' : `${selectedSite} <span class="dropdown-arrow">▼</span>`;
      document.getElementById('siteDropdownMenu').classList.remove('show');
      dropdownBtn.classList.remove('active');

      window.currentSite = selectedSite;
      const selSection = document.querySelector('.toggle-btn.active:not(.dropdown-btn)').dataset.section;
      const selFilter = document.querySelector('.legend-btn.active').dataset.filter;
      renderTable(window.appData, window.siteMapping, selSection, selFilter, selectedSite);
    });
  });
};

// -------------------- Initialization --------------------
document.addEventListener('DOMContentLoaded', () => {
  // application state on window for convenience
  window.appData = null;
  window.siteMapping = null;
  window.currentSite = 'all';
  let currentSection = 'sharedInfrastructure';
  let currentFilter = 'all';

  // fetch both JSON files
  // Note: GitHub Pages will serve these from same repo, path: /data/data.json and /data/site-mapping.json
  Promise.all([
    fetch('data/data.json').then(r => r.ok ? r.json() : Promise.reject('data.json not found')),
    fetch('data/site-mapping.json').then(r => r.ok ? r.json() : Promise.resolve({}))
  ]).then(([data, mapping]) => {
    window.appData = data;
    window.siteMapping = mapping;

    // populate dropdown
    populateSiteDropdown(mapping);

    // attach button listeners (sections)
    document.querySelectorAll('.toggle-btn:not(.dropdown-btn)').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.toggle-btn:not(.dropdown-btn)').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentSection = this.dataset.section;
        renderTable(window.appData, window.siteMapping, currentSection, currentFilter, window.currentSite);
      });
    });

    // legend filters
    document.querySelectorAll('.legend-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.legend-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentFilter = this.dataset.filter;
        renderTable(window.appData, window.siteMapping, currentSection, currentFilter, window.currentSite);
      });
    });

    // dropdown toggle
    document.getElementById('siteDropdown').addEventListener('click', function (e) {
      e.stopPropagation();
      const menu = document.getElementById('siteDropdownMenu');
      menu.classList.toggle('show');
      this.classList.toggle('active');
    });

    // close dropdown on outside click
    window.addEventListener('click', function () {
      const menu = document.getElementById('siteDropdownMenu');
      const btn = document.getElementById('siteDropdown');
      menu.classList.remove('show');
      btn.classList.remove('active');
    });

    // initial render
    renderTable(window.appData, window.siteMapping, currentSection, currentFilter, window.currentSite);
  }).catch(err => {
    console.error('Failed loading data files:', err);
    document.querySelector('tbody').innerHTML = `<tr><td colspan="5" style="color:#c00;padding:20px">Failed loading data files: ${err}</td></tr>`;
  });
});
