<div align="center">
  
  <h1>INSPIRE Lite</h1>
  <h3><b>A Minimalist Campus Management Information System</b></h3>  
  <p>A native, modern academic web portal engineered for high performance and clean data routing.</p>
  
  [![Environment](https://img.shields.io/badge/Stack-Native%20PHP%20%7C%20MariaDB-blue.svg?style=flat)]()
  [![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat)]()
</div>

## 🚀 Overview
**INSPIRE Lite** is a native web framework designed to deliver a better, vanilla alternative to existing university portals. Functioning as a centralized digital campus platform inspired by UNSRAT's academic infrastructure, it streamlines student authentication, profile directories, and semester course metrics with zero framework overhead.

---

## 📂 Project Directory Structure

```inspire-lite/
├── assets/
│   ├── css/
│   │   └── style.css                 # Core CSS
│   └── img/
│       ├── background.png            # Blurred glassmorphism backdrop asset
│       └── logo.png                  # Centered portal brand header img (300x100)
├── config/
│   ├── db.php                        # Production PDO database client instance
│   └── db.example.php                # Local environment template configuration
├── admin/
│   └── dashboard.php                 # Administrative system controls, user provisioning, and portal configuration panel.
├── staff/
│   └── dashboard.php                 # Academic records management, student enrollment registry, and administrative operations.
├── lecturer/
│   └── dashboard.php                 # Instructor grade management, course syllabus assignment, and student evaluation panel.
├── student/
│   ├── profil/
│   │   └── index.php                 # Student biodata & profile viewer
│   ├── pusat-informasi/
│   │   └── index.php                 # Campus info bulletin hub
│   ├── perkuliahan/
│   │   ├── jadwal.php                # Jadwal Kuliah (Course schedules)
│   │   ├── krs.php                   # Kartu Rencana Studi (Course registration)
│   │   ├── khs.php                   # Kartu Hasil Studi (Semester grades)
│   │   ├── presensi.php              # Attendance verification tracker
│   │   ├── tugas.php                 # Assignment sub-panel (Dynamic task rows)
│   │   ├── bimbingan.php             # Academic counseling entry point
│   │   ├── kartu-mahasiswa.php       # KTM (Digital Student ID card generator)
│   │   └── transkrip.php             # Cumulative academic transcript viewer
│   ├── kemahasiswaan/
│   │   ├── beasiswa.php              # Scholarship application tracker
│   │   ├── prestasi.php              # Student achievements log
│   │   ├── kompetisi.php             # Academic & non-academic competitions
│   │   ├── organisasi.php            # Campus student organizations portal
│   │   ├── kkt.php                   # Kuliah Kerja Terpadu (KKT/KKN routing)
│   │   ├── praktik-lapangan/
│   │   │   ├── pembimbing.php        # Internship field supervisor assignment
│   │   │   └── seminar.php           # Field internship presentation evaluation
│   │   ├── skripsi-tesis/
│   │   │   ├── proposal.php          # Thesis topic & proposal submission
│   │   │   ├── pembimbingan.php      # Advisor consultation logs tracker
│   │   │   ├── hasil.php             # Research results defense panel
│   │   │   └── ujian-akhir.php       # Final thesis viva examination
│   │   └── wisuda/
│   │       ├── informasi.php         # Graduation requirements info hub
│   │       ├── daftar.php            # Graduation registry application
│   │       └── validasi.php          # Clearance validation checklists
│   ├── perpustakaan/
│   │   └── index.php                 # Digital library integration entry
│   ├── fasilitas/
│   │   ├── kalender.php              # Academic activities event calendar
│   │   ├── email.php                 # Official student institutional mail access
│   │   └── wifi.php                  # Campus Wi-Fi single sign-on access manager
│   ├── administrasi/
│   │   ├── billing.php               # Tuition fees payment registry
│   │   └── cuti-pindah/
│   │       ├── cuti.php              # Academic leave request processing
│   │       ├── pindah-prodi.php      # Internal major transfer gateway
│   │       └── pindah-keluar.php     # External university transfer processing
│   └── dashboard.php                 # Budi's main panel (Hero banner & Quick Actions)
├── .gitignore                        # Excludes editor logs, secrets, and Syncthing folders
├── LICENSE                           # MIT Open Source permissions file
├── index.php                         # Application routing gateway controller
├── login.php                         # Glassmorphism login engine with input tracking icons
└── logout.php                        # Session lifecycle cleanup management script
```
