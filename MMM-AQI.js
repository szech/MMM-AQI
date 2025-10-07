/* MagicMirror²
 * Module: MMM-AQI
 * By Ricardo Gonzalez https://github.com/ryck/MMM-AQI
 * MIT Licensed.
 */
Module.register("MMM-AQI", {
  defaults: {
    token: "",
    city: "here",
    iaqi: true,
    updateInterval: 30 * 60 * 1000, // Every half hour.
    overrideCityDisplayName: null,
    initialLoadDelay: 0, // No delay/
    animationSpeed: 1000, // One second.
    debug: false
  },
  
  
  start () {
    Log.info(`Starting module: ${this.name}`)
    this.loaded = false
    this.result = null
    this.scheduleUpdate(this.config.initialLoadDelay)
    this.updateTimer = null
    this.apiBase = `https://api.waqi.info/feed/${this.config.city}/`
    this.url = encodeURI(this.apiBase + this.getParams())
    
    // Helper lists for organizing the data into columns
    this.ATMOSPHERIC_KEYS = ["t", "h", "p", "w", "uvi"]
    this.POLLUTANT_KEYS = ["pm25", "pm10", "no2", "o3", "so2"]

    this.displayNames = new Map([
      // Pollution measurements
      ["pm25", "PM<sub>2.5</sub>"],
      ["pm10", "PM<sub>10</sub>"],
      ["o3", "O<sub>3</sub>"],
      ["no2", "NO<sub>2</sub>"],
      ["so2", "SO<sub>2</sub>"],
      ["co", "CO"],
      // Atmospheric measurements
      ["t", "Temperature 🌡️"],
      ["w", "Wind 🍃"],
      ["r", "Rain 🌧️"],     // not used
      ["h", "Rel. humidity 💧"],
      ["d", "Dewpoint"],    // not used
      ["p", "Pressure 🌫️"],
      ["uvi", "UV Index 😎"],
      ["wg", "WG"]          // wtf is WG?
    ])

    this.displayUnits = new Map([
      ["t", "&#xb0;C"],
      ["w", "m/s"],
      ["r", "mm"],          // not used
      ["h", "%"],
      ["d", "Dewpoint"],    // not used
      ["p", "hPa"],
      ["uvi", ""],
      ["wg", "WG"]          // wtf is WG?
    ])

    
      if (this.config.debug) {
      Log.info(this.url)
    }
    this.updateAQI(this)
  },
  // updateAQI
  updateAQI (self) {
    self.sendSocketNotification("GET_AQI", {url: self.url})
  },

  getStyles () {
    return ["MMM-AQI.css", "weather-icons.css"]
  },
  // Define required scripts.
  getScripts () {
    return ["moment.js"]
  },
  // Define header for module.
  getHeader () {
    return this.data.header
  },

  // Override dom generator.
  getDom () {
    const wrapper = document.createElement("div")

    if (this.config.sensorPin === "") {
      wrapper.innerHTML = "Please set the API token."
      wrapper.className = "dimmed light small"
      return wrapper
    }

    if (!this.loaded) {
      wrapper.innerHTML = "Loading Air Quality Index (AQI)..."
      wrapper.className = "dimmed light small"
      return wrapper
    }

    // Start building table.
    const dataTable = document.createElement("table")
    dataTable.className = "small data"

    if (this.result.data != null) {
    const aqi = this.result.data.aqi
    const city = this.config.overrideCityDisplayName ?? this.result.data.city.name
    const aqiClass = this.getAQIClass(aqi)

    // 1. Create the Header Row
    const headerRow = document.createElement("tr")
    
    const cityHeaderCell = document.createElement("th")
    cityHeaderCell.colSpan = 2
    cityHeaderCell.className = `header city ${aqiClass}`
    cityHeaderCell.innerHTML = `${city}`

    const aqiHeaderCell = document.createElement("th")
    aqiHeaderCell.colSpan = 1 
    aqiHeaderCell.className = `header aqi title ${aqiClass}`
    aqiHeaderCell.innerHTML = `AQI:`

    const aqiValueHeaderCell = document.createElement("th")
    aqiValueHeaderCell.colSpan = 1 
    aqiValueHeaderCell.className = `header aqi value ${aqiClass}`
    aqiValueHeaderCell.innerHTML = `${aqi}`
    
    headerRow.appendChild(cityHeaderCell)    
    headerRow.appendChild(aqiHeaderCell)
    headerRow.appendChild(aqiValueHeaderCell)
    dataTable.appendChild(headerRow)

      // 2. Add IAQI data rows (if configured)
      if (this.config.iaqi) {
          const iaqi = this.result.data.iaqi
          const uvi = this.result.data.forecast.daily.uvi[0]  // today's uvi forecast
          // Determine the maximum number of rows needed
          const maxRows = Math.max(this.ATMOSPHERIC_KEYS.length, this.POLLUTANT_KEYS.length)

          for (let i = 0; i < maxRows; i++) {
              const atmKey = this.ATMOSPHERIC_KEYS[i]
              const polKey = this.POLLUTANT_KEYS[i]
              
              // Check if *any* data exists for this row index before creating the row
              const hasAtmosphericData = (atmKey && iaqi[atmKey]) || (atmKey == "uvi" && Object.keys(uvi).length > 0)
              const hasPollutantData = polKey && iaqi[polKey]

              if (hasAtmosphericData || hasPollutantData) {
                  const dataRow = document.createElement("tr")
                  
                  // --- First Two Columns: Atmospheric Conditions (e.g., t, h) ---
                  if (hasAtmosphericData) {
                      // Key (t, h, p, etc.)
                      const keyCell = document.createElement("td")
                      keyCell.className = `small atm key` 
                      keyCell.innerHTML = this.displayNames.get(atmKey)
                      dataRow.appendChild(keyCell)

                      // Value
                      const valueCell = document.createElement("td")
                      
                      // Use Math.round for cleaner display of decimal values
                      value = ""
                      if(atmKey == "uvi") {
                        value = this.getUVIValue(uvi)
                      } else {
                        value = Math.round(iaqi[atmKey].v)
                      }
                      
                      valueCell.innerHTML = value + this.displayUnits.get(atmKey)
                   
                      // set classes
                      valueCell.className = `small atm value`
                      valueCell.className += atmKey == "t" ? this.getTemperatureClass(value) : ""
                      valueCell.className += atmKey == "uvi" ? this.getUVIClass(value) : ""
                      valueCell.className += atmKey == "h" ? this.getHumidityClass(value) : ""
                      valueCell.className += atmKey == "w" ? this.getWindSpeedClass(value) : ""
                      valueCell.className += atmKey == "p" ? this.getPressureClass(value) : ""
                      
                      dataRow.appendChild(valueCell)

                  } else {
                      // Placeholders to maintain 4-column structure if data is missing
                      dataRow.appendChild(document.createElement("td"))
                      dataRow.appendChild(document.createElement("td"))
                  }

                  // --- Third & Fourth Columns: Pollutants (e.g., pm25, no2) ---
                  if (hasPollutantData) {
                      // Key (pm25, no2, etc.)
                      const keyCell = document.createElement("td")
                      keyCell.className = `small iaqi key`
                      keyCell.innerHTML = this.displayNames.get(polKey)
                      dataRow.appendChild(keyCell)

                      // Value
                      const valueCell = document.createElement("td")
                      valueCell.className = `small iaqi value ${aqiClass} ${polKey}`
                      valueCell.innerHTML = Math.round(iaqi[polKey].v)
                      dataRow.appendChild(valueCell)
                  } else {
                      // Placeholders to maintain 4-column structure if data is missing
                      dataRow.appendChild(document.createElement("td"))
                      dataRow.appendChild(document.createElement("td"))
                  }

                  dataTable.appendChild(dataRow)
              }
          }
      }
    } else { // no data
        const row1 = document.createElement("tr")
        dataTable.appendChild(row1)

        const messageCell = document.createElement("td")
        messageCell.innerHTML = this.result.message
        messageCell.colSpan = 4 
        messageCell.className = ""
        row1.appendChild(messageCell)

        const row2 = document.createElement("tr")
        dataTable.appendChild(row2)

        const timeCell = document.createElement("td")
        timeCell.innerHTML = this.result.timestamp
        timeCell.colSpan = 4
        timeCell.className = "small"
        row2.appendChild(timeCell)
    }



    wrapper.appendChild(dataTable)
    return wrapper
  },



  processAQI (result) {
    this.result = {}
    this.result.timestamp = moment().format("LLL")
    if (typeof result !== "undefined" && result != null) {
      if (this.config.debug) {
        Log.info(result)
      }
      this.result.data = result.data
    } else {
      // No data returned - set error message
      this.result.message = "No data returned"
      this.result.data = null
      if (this.config.debug) {
        Log.error("No data returned")
        Log.error(this.result)
      }
    }
    this.updateDom(this.config.animationSpeed)
    this.loaded = true
  },


// Assign aqi class name.
  getAQIClass(aqi) {
      switch (true) {
        case aqi <= 0:
          return  "empty"
        case aqi > 0 && aqi < 51:
          return  "good"
        case aqi >= 51 && aqi < 101:
          return  "moderate"
        case aqi >= 101 && aqi < 151:
          return  "unhealthy-sensitive bright"
        case aqi >= 151 && aqi < 201:
          return  "unhealthy bright"
        case aqi >= 201 && aqi < 300:
          return  "very-unhealthy bright"
        case aqi >= 300:
          return  "hazardous bright"
      }
    },

// Assign UV Index class name.
  getUVIClass(uvi) {
      switch (true) {
        case uvi <= 2:
          return  "good"
        case uvi >= 3 && uvi <= 5:
          return  "moderate"
        case uvi >= 6 && uvi <= 7:
          return  "unhealthy-sensitive bright"
        case uvi >= 8 && uvi <= 10:
          return  "unhealthy bright"
        case uvi >= 11 && uvi <= 14:
          return  "very-unhealthy bright"
        case uvi >= 15:
          return  "hazardous bright"
      }
    },


  // Assign temperature class name.
  getTemperatureClass(t) {
      switch (true) {
        case t <= -10:
          return  "darkblue bright"
        case t > -10 && t <= 0:
          return  "blue"
        case t > 0 && t < 10:
          return  "lightgreen"
        case t >= 10 && t < 15:
          return  "lightyellow"
        case t >= 15 && t < 20:
          return  "yellow"
        case t >= 20 && t < 25:
          return  "orange"
        case t >= 25 && t < 30:
          return  "darkorange"
        case t >= 30 && t < 35:
          return  "red"
        case t >= 35 && t < 40:
          return  "darkred bright"
        case t >= 40:
          return  "purple bright"
      }
    },

    // Assign wind speed class name.
    getWindSpeedClass(w) {
        switch (true) {
          case w <= 1:
            return  ""
          case w > 1 && w <= 5:
            return  "good"
          case w > 5 && w < 11:
            return  "moderate"
          case w >= 11 && w < 17:
            return  "unhealthy-sensitive"
          case w >= 17 && w < 24:
            return  "unhealthy bright"
          case w >= 25:
            return  "hazardous bright"
        }
      },



    // Assign humidity class name.
    getHumidityClass(h) {
      switch (true) {
        case h <= 30:
          return  "unhealthy-sensitive"
        case h >= 31 && h < 41:
          return  "moderate"  
        case h >= 41 && h < 66:
          return  "good"
        case h >= 66 && h < 80:
          return  "moderate"
        case h >= 80 && h < 91:
          return  "unhealthy-sensitive"
        case h >= 91:
          return  "underwater"
      }
    },


    // Assign pressure class name.
    // Standard atmospheric pressure is 1013 hPa
    getPressureClass(p) {
      switch (true) {
        case p < 980:
          return  "darkblue"
        case p >= 980 && p < 1000:
          return  "blue"  
        case p >= 1000 && p < 1020:
          return  ""
        case p >= 1020 && p < 1035:
          return  "lightyellow"
        case p >= 1035:
          return  "yellow"
      }
    },

  /**
   * @param {*} uvi: the uvi json data
   * @returns the forecast uvi value based on the time now
   */
  getUVIValue(uvi) {
    timeslot = this.determineCardiffTimeSlot()
    if(timeslot == '1') {
      return uvi.avg
    }

    if(timeslot == '2') {
      return uvi.max
    }

    return uvi.min
  },



  /**
  * Function to get the current hour in a specific timezone (Cardiff uses Europe/London).
  * This function is needed because we need the HOUR integer for the switch logic.
  */
  getCurrentCardiffHour() {
    // Get the current time adjusted for the Europe/London timezone (which covers Cardiff)
    const options = {
        timeZone: 'Europe/London',
        hour: 'numeric',
        hour12: false
    };

    // Create a formatter and get the hour string, then convert to an integer
    const formatter = new Intl.DateTimeFormat('en-GB', options);
    const hourString = formatter.format(new Date());
    return parseInt(hourString, 10);
  },

  /**
  * Determines the current time slot in Cardiff based on fixed intervals and placeholder
  * dawn/dusk times.
  * * NOTE: Real-world applications should use an external API (like a weather service) 
  * to determine accurate dawn/dusk times dynamically.
  */
  determineCardiffTimeSlot() {
    // Placeholder times for October in Cardiff (using 24-hour format)
    const DAWN_HOUR = 7;   // e.g., 7 AM
    const DUSK_HOUR = 18;  // e.g., 6 PM

    const currentHour = this.getCurrentCardiffHour();
    let timeSlot = '';

    // We switch on 'true' to allow complex range comparisons within the case statements.
    switch (true) {
        // Case 1: Before Dawn (e.g., 00:00 up to 06:59)
        case currentHour < DAWN_HOUR:
            timeSlot = '0'; // no UV
            break;

        // Case 2: Dawn to 10:00 (e.g., 07:00 up to 09:59)
        case currentHour >= DAWN_HOUR && currentHour < 10:
            timeSlot = '1'; // average UV
            break;

        // Case 3: 10:00 to 15:00 (e.g., 10:00 up to 14:59)
        case currentHour >= 10 && currentHour < 15:
            timeSlot = '2'; // max
            break;

        // Case 4: 15:00 to Dusk (e.g., 15:00 up to 17:59)
        case currentHour >= 15 && currentHour < DUSK_HOUR:
            timeSlot = '1';
            break;

        // Case 5: Dusk to 00:00 (e.g., 18:00 up to 23:59)
        case currentHour >= DUSK_HOUR && currentHour < 24:
            timeSlot = '0';
            break;

        default:
            timeSlot = '0'; // Error!
            break;
    }

    console.log(`Current Hour in Cardiff: ${currentHour}:00`);
    console.log(`Determined Time Slot: ${timeSlot}`);
    return timeSlot;
},


  getParams () {
    let params = "?"
    params += `token=${this.config.token}`
    if (this.config.debug) {
      Log.info(params)
    }
    return params
  },
  /* scheduleUpdate()
   * Schedule next update.
   * argument delay number - Milliseconds before next update. If empty, this.config.updateInterval is used.
   */
  scheduleUpdate (delay) {
    let nextLoad = this.config.updateInterval
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay
    }

    const self = this
    clearTimeout(this.updateTimer)
    this.updateTimer = setTimeout(() => {
      self.updateAQI(self)
    }, nextLoad)
  },
  // Process data returned
  socketNotificationReceived (notification, payload) {
    if (notification === "AQI_DATA" && payload.url === this.url) {
      this.processAQI(payload.data)
      this.scheduleUpdate(this.config.updateInterval)
    }
  },
})
