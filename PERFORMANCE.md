# Checking Extension Performance in Firefox

Since you are running Firefox on a remote server (likely via Docker/VNC), here is how you can monitor the resource usage (RAM and CPU) of **Arint Screenshot**.

## 1. Open the Task Manager (about:processes)
The most accurate tool is Firefox's built-in Process Manager.

1.  In the Firefox address bar, type:
    ```
    about:processes
    ```
    and press **Enter**.
    
    *(Alternatively: Click the Menu (≡) > More tools > Task Manager)*

## 2. Locate the Extension
1.  Look through the list for **"Extension: Arint Screenshot"**.
2.  You will see two real-time usage stats:
    *   **Memory**: How much RAM the extension is currently holding.
    *   **CPU**: How much processing power it is using.

## 3. Expected Values
*   **Idle**: Should be very low (e.g., < 20MB RAM, 0% CPU). The extension "sleeps" when not in use.
*   **During Capture**: You might see a momentary spike (up to 200MB+ for full page) as it processes the images in memory.
*   **After Capture**: Once you close the editor tab, the memory should drop back down as the browser performs garbage collection.

## 4. Advanced Debugging
If you need deeper details, you can visit:
```
about:memory
```
And click **"Measure"** to see a granular breakdown of memory allocation, though `about:processes` is usually sufficient for general monitoring.
