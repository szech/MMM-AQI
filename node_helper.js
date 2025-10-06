/* MagicMirror²
 * Module: MMM-AQI
 * By Ricardo Gonzalez
 * MIT Licensed.
 */

const Log = require("logger");
const NodeHelper = require("node_helper");
const MAX_ATTEMPTS = 5; // Initial attempt + 2 retries
const INITIAL_DELAY_MS = 1000; // 1 second
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));


module.exports = NodeHelper.create({
  start () {
    Log.log("MMM-AQI helper started ...");
  },



  /* getAQIData()
   * Requests new data from AirNow API.
   * Sends data back via socket on succesfull response.
   */
  async getAQIData (url) {
    const self = this;
    let attempt = 1;

    // Loop for a maximum of 3 attempts (1 initial + 2 retries)
    while (attempt <= MAX_ATTEMPTS) {
        
        console.debug(`[MMM-AQI] Starting fetch attempt ${attempt} for URL: ${url}`);

        try {
            // 1. Attempt the network request
            const response = await fetch(url);

            // 2. Check for success (HTTP status 200-299)
            if (response.ok) {
                const data = await response.json();
                self.sendSocketNotification("AQI_DATA", {
                    data,
                    url,
                });
                console.debug(`[MMM-AQI] Data successfully retrieved on attempt ${attempt}.`);
                return; // 🎯 SUCCESS: Exit the function immediately
            }

            // 3. Handle non-OK response (4xx, 5xx)
            const errorText = await response.text();
            console.warn(
                `❌ [MMM-AQI] Attempt ${attempt} failed. Status: ${response.status} (${response.statusText}).`
            );
            console.warn(`Response details: ${errorText.substring(0, 100)}...`);

        } catch (error) {
            // 4. Handle network/fetch-related errors (DNS, timeout, etc.)
            console.warn(`💥 [MMM-AQI] Attempt ${attempt} failed with network error:`, error.message);
        }

        // 5. Check if retries are available and wait
        if (attempt < MAX_ATTEMPTS) {
            var DELAY_MS = INITIAL_DELAY_MS * attempt * 1.5
            console.debug(`[MMM-AQI] Retrying in ${DELAY_MS / 1000} seconds...`);
            await wait(DELAY_MS); // pause then retry
        } else {
            // Max attempts reached, log the final failure
            console.warn(`⛔ [MMM-AQI] Failed to retrieve data after ${MAX_ATTEMPTS} attempts. Giving up.`);
        }

        attempt++;
    }
  },

  // Subclass socketNotificationReceived received.
  socketNotificationReceived (notification, payload) {
    if (notification === "GET_AQI") {
      this.getAQIData(payload.url);
    }
  },


});
