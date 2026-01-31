# Arint Screenshot

<div align="center">
  <img src="icons/icon-original.png" alt="Arint Screenshot Logo" width="128" height="128" />
  
  <h3>The Ultimate Privacy-First Screenshot Tool for Firefox</h3>

  <p>
    Capture, Edit, and Save. 100% Local. Zero Tracking.
  </p>

  [Features](#-features) • [Privacy](#-privacy-focus) • [Performance](#-optimized-performance) • [Installation](#-installation)
</div>

---

## Overview

**Arint Screenshot** is a high-performance, lightweight Firefox extension designed for speed and privacy. Built with modern web standards (Manifest V3), it allows you to capture visible areas, full web pages, or custom regions instantly—without sending a single byte of data to the cloud.

Includes a powerful built-in editor that automatically adapts to your system's Light or Dark theme.

## ✨ Features

### 📸 Versatile Capture Modes
*   **Visible Area**: Instantly snap what you see on your screen.
*   **Full Page**: Automatically scrolls and stitches long webpages into a single, high-resolution image.
*   **Select Region**: Drag to capture a specific area with pixel-perfect precision.

### 🎨 Built-in Editor
Edit your screenshots immediately after capture, completely offline:
*   **Crop**: Trim visuals to the perfect size.
*   **Draw**: Annotate with a responsive, smooth pen tool (customizable colors & size).
*   **Zoom**: Deep zoom capabilities for precise editing.
*   **Auto-Theming**: The interface respects your OS preference (Light/Dark mode) for a seamless experience.

### ⚡ Optimized Performance
*   **Zero-Idle Ram**: Utilizes a Service Worker (MV3) architecture, meaning the extension unloads from memory when not in use.
*   **Low CPU Usage**: Written in pure Vanilla JavaScript with no heavy frameworks, making it fly even on older hardware.
*   **Memory Efficient**: Large image buffers are instantly flushed from memory after processing.

## 🔒 Privacy Focus

We believe your data belongs to you. Arint Screenshot is engineered with a **Privacy-First** architecture:

*   **100% Local Execution**: All image processing happens inside your browser.
*   **No Analytics**: We do not track your usage or collect personal data.
*   **No External Requests**: The extension makes zero HTTP requests to external servers.
*   **Minimal Permissions**: We only request `activeTab` (when you click) and `scripting` (to scroll the page). We verified this with a full code audit.

## 🛠 Installation

### From Firefox Add-ons (Recommended)
*(Link to AMO listing will be added here once published)*

### Manual Installation (Developer Mode)
1.  Clone this repository.
2.  Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3.  Click **"Load Temporary Add-on..."**.
4.  Select the `manifest.json` file from the cloned folder.

## ⌨️ Shortcuts

| Action | Shortcut |
| :--- | :--- |
| **Visible Capture** | `1` (Popup open) |
| **Full Page** | `2` (Popup open) |
| **Region Select** | `3` (Popup open) |
| **Copy Image** | `Ctrl` + `C` (Editor) |
| **Save Image** | `Ctrl` + `S` (Editor) |
| **Undo / Redo** | `Ctrl` + `Z` / `Ctrl` + `Shift` + `Z` |

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/arintsohaib/Arint-Screenshot/issues).

## License

This project is open source and available under the [MIT License](LICENSE).
