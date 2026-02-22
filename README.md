# TradeLog - Modern Trading Journal

A clean, minimal, and professional trading journal web application built with HTML, CSS, and Vanilla JavaScript. Designed for traders who want to track their performance across multiple accounts without the need for a complex backend.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **SaaS Dashboard Style**: Modern dark mode UI inspired by Linear.app.
- **Account Types**: Support for **Standard (USD)** and **Cent (USC)** accounts with specific formatting.
- **Multiple Accounts**: Manage different trading strategies (e.g., Scalping, Swing) with separate statistics.
- **Journal Entries**: Detailed trade logging including Pair, Direction, Lot, Entry, SL, TP, Emotion, and Notes.
- **Analytics**: 
    - Real-time Equity Curve.
    - Win vs Loss distribution chart.
    - Automatic calculations (Winrate, Growth %, RR, Max Drawdown).
- **Persistent Data**: Uses `localStorage` to keep your data safe in your browser.
- **Responsive**: Works smoothly on Desktop and Tablet.

## 🚀 How to Run Locally

1. Clone or download this repository.
2. Open `index.html` in any modern web browser.
3. Login using any username/password (it's a dummy authentication).

## 🌐 Deployment (GitHub Pages)

This application is ready to be hosted on **GitHub Pages** for free.

1. **Create a Repository**: Create a new public repository on GitHub.
2. **Upload Files**: Upload `index.html`, `dashboard.html`, `style.css`, and `app.js` to the main branch.
3. **Enable Pages**:
   - Go to your repository **Settings**.
   - Click on **Pages** in the left sidebar.
   - Under "Build and deployment", set the branch to `main` (or `master`) and folder to `/ (root)`.
   - Click **Save**.
4. **Access your site**: GitHub will provide a URL (usually `https://your-username.github.io/your-repo-name/`).

## 🛠️ Built With

- **HTML5 & CSS3**: Custom grid and flexbox layout.
- **Vanilla JavaScript**: State management and CRUD logic.
- **Chart.js**: Financial data visualization.
- **FontAwesome**: Modern icons.
- **Google Fonts**: Inter & Poppins typography.

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
