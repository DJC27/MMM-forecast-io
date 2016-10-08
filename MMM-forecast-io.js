Module.register("MMM-forecast-io", {

  defaults: {
    apiKey: "",
    apiBase: "https://api.darksky.net/forecast",
    units: config.units,
    language: config.language,
    updateInterval: 5 * 60 * 1000, // every 5 minutes
    animationSpeed: 1000,
    initialLoadDelay: 0, // 0 seconds delay
    retryDelay: 2500,
    tempDecimalPlaces: 0, // round temperatures to this many decimal places
    geoLocationOptions: {
      enableHighAccuracy: true,
      timeout: 5000
    },
    latitude:  null,
    longitude: null,
    forecastWidth: 400,
    showForecast: true,
    showPrecipitationGraph: true,
    testElementID: "forecast-io-test-element",
    unitTable: {
      'default':  'auto',
      'metric':   'si',
      'imperial': 'us'
    },
    iconTable: {
      'clear-day':           'wi-day-sunny',
      'clear-night':         'wi-night-clear',
      'rain':                'wi-rain',
      'snow':                'wi-snow',
      'sleet':               'wi-rain-mix',
      'wind':                'wi-cloudy-gusts',
      'fog':                 'wi-fog',
      'cloudy':              'wi-cloudy',
      'partly-cloudy-day':   'wi-day-cloudy',
      'partly-cloudy-night': 'wi-night-cloudy',
      'hail':                'wi-hail',
      'thunderstorm':        'wi-thunderstorm',
      'tornado':             'wi-tornado'
    },

    debug: false
  },

  getTranslations: function () {
    return false;
  },

  getScripts: function () {
    return [
      'jsonp.js',
      'moment.js'
    ];
  },

  getStyles: function () {
    return ["weather-icons.css", "MMM-forecast-io.css"];
  },

  shouldLookupGeolocation: function () {
    return this.config.latitude == null &&
           this.config.longitude == null;
  },

  start: function () {
    Log.info("Starting module: " + this.name);

    if (this.shouldLookupGeolocation()) {
      this.getLocation();
    }
    this.scheduleUpdate(this.config.initialLoadDelay);
  },

  updateWeather: function () {
    if (this.geoLocationLookupFailed) {
      return;
    }
    if (this.shouldLookupGeolocation() && !this.geoLocationLookupSuccess) {
      this.scheduleUpdate(1000); // try again in one second
      return;
    }

    var units = this.config.unitTable[this.config.units] || 'auto';

    var url = this.config.apiBase+'/'+this.config.apiKey+'/'+this.config.latitude+','+this.config.longitude+'?units='+units+'&lang='+this.config.language;
    if (this.config.data) {
      // for debugging
      this.processWeather(this.config.data);
    } else {
      getJSONP(url, this.processWeather.bind(this));
    }
  },

  processWeather: function (data) {
    if (this.config.debug) {
      console.log('weather data', data);
    }
    this.loaded = true;
    this.weatherData = data;
    this.temp = this.roundTemp(this.weatherData.currently.temperature);
    this.updateDom(this.config.animationSpeed);
    this.scheduleUpdate();
  },

  notificationReceived: function(notification, payload, sender) {
    switch(notification) {
      case "DOM_OBJECTS_CREATED":
        break;
    }
  },

  getDom: function() {
    var wrapper = document.createElement("div");

    if (this.config.apiKey === "") {
      wrapper.innerHTML = "Please set the correct forcast.io <i>apiKey</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (this.geoLocationLookupFailed) {
      wrapper.innerHTML = "Geolocaiton lookup failed, please set <i>latitude</i> and <i>longitude</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      wrapper.innerHTML = this.translate('LOADING');
      wrapper.className = "dimmed light small";
      // need this for the initial load
      wrapper.appendChild(this.createTextWidthTestElement());
      return wrapper;
    }

    var currentWeather = this.weatherData.currently;
    var hourly         = this.weatherData.hourly;
    var minutely       = this.weatherData.minutely;

    var large = document.createElement("div");
    large.className = "large light";

    var icon = minutely ? minutely.icon : hourly.icon;
    var iconClass = this.config.iconTable[hourly.icon];
    var icon = document.createElement("span");
    icon.className = 'big-icon wi ' + iconClass;
    large.appendChild(icon);

    var temperature = document.createElement("span");
    temperature.className = "bright";
    temperature.innerHTML = " " + this.temp + "&deg;";
    large.appendChild(temperature);

    var summaryText = minutely ? minutely.summary : hourly.summary;
    // remove ending '.' for consistency with the interface
    summaryText = summaryText.replace(/\.$/, '');
    var summary = document.createElement("div");
    summary.className = "small dimmed";
    summary.innerHTML = summaryText;

    wrapper.appendChild(large);
    // wrapper.appendChild(summary);

    if (minutely && this.config.showPrecipitationGraph) {
      wrapper.appendChild(this.renderPrecipitationGraph());
    }

    if (this.config.showForecast) {
      wrapper.appendChild(this.renderWeatherForecast());
    }

    // need this for subsequent loads
    wrapper.appendChild(this.createTextWidthTestElement());

    return wrapper;
  },

  renderPrecipitationGraph: function () {
    var i;
    var width = this.config.forecastWidth;
    var height = Math.round(width * 0.6);
    var element = document.createElement('canvas');
    element.className = "precipitation-graph"
    element.width  = width;
    element.height = height;
    var context = element.getContext('2d');

    var sixth = Math.round(width / 6);
    context.save();
    context.strokeStyle = 'white';
    context.lineWidth = 2;
    for (i = 1; i < 6; i++) {
      context.moveTo(i * sixth, height);
      context.lineTo(i * sixth, height - 10);
      context.stroke();
    }
    context.restore();

    var third = Math.round(height / 3);
    context.save();
    context.strokeStyle = 'gray';
    context.setLineDash([5, 15]);
    context.lineWidth = 1;
    for (i = 1; i < 3; i++) {
      context.moveTo(0, i * third);
      context.lineTo(width, i * third);
      context.stroke();
    }
    context.restore();

    var data = this.weatherData.minutely.data;
    var stepSize = Math.round(width / data.length);
    context.save();
    context.strokeStyle = 'white';
    context.fillStyle = 'white';
    context.globalCompositeOperation = 'xor';
    context.beginPath();
    context.moveTo(0, height);
    var intensity
    for (i = 0; i < data.length; i++) {
      if (data[i].precipProbability < 0.1) {
        intensity = 0;
      } else {
        intensity = 20 * data[i].precipIntensity * height;
      }
      context.lineTo(i * stepSize, height - intensity);
    }
    context.lineTo(width, height);
    context.closePath();
    context.fill();
    context.restore();

    return element;
  },

  createTextWidthTestElement: function () {
    var element = document.createElement("div");
    element.id = this.config.testElementID;
    element.style.position = 'absolute';
    element.style.visibility = 'hidden';
    element.style.height = 'auto';
    element.style.width = 'auto';
    element.style['white-space'] = 'nowrap';
    return element;
  },

  getTextWidth: function (text, classes) {
    var element = document.getElementById(this.config.testElementID);
    element.className = classes || "";
    element.innerHTML = text;
    return element.clientWidth + 1;
  },

  getDayFromTime: function (time) {
    var dt = new Date(time * 1000);
    return moment.weekdaysShort(dt.getDay());
  },

  renderForcastDayAndIcon: function (data) {
    var day = this.getDayFromTime(data.time);
    var dayDiv = document.createElement("div");
    dayDiv.className = "forecast-day"
    var dayTextSpan = document.createElement("span");
    dayTextSpan.className = "forecast-day-text"
    dayTextSpan.innerHTML = day;
    var iconClass = this.config.iconTable[data.icon];
    var icon = document.createElement("span");
    icon.className = 'wi weathericon ' + iconClass;
    dayDiv.appendChild(dayTextSpan);
    dayDiv.appendChild(icon);
    return dayDiv;
  },

  renderForecastRow: function (data, min, max, maxDayDivWidth) {
    var total = max - min;
    var rowMinTemp = this.roundTemp(data.temperatureMin);
    var rowMaxTemp = this.roundTemp(data.temperatureMax);

    var row = document.createElement("div");
    row.className = "forecast-row";

    // var dayDiv = this.renderForcastDayAndIcon(data);
    // extra em for space
    // dayDiv.style.width = "calc("+maxDayDivWidth + "px + 1em)";

    var interval = 100 / total;
    var bar = document.createElement("span");
    bar.className = "bar";
    var barWidth = Math.round(interval * (rowMaxTemp - rowMinTemp));
    bar.style.width = barWidth + '%';
    bar.setAttribute("data-min-temp", rowMinTemp);
    bar.setAttribute("data-max-temp", rowMaxTemp);
    bar.innerHTML = "nbsp;";

    bar.style["left"] = (interval * (rowMinTemp - min)) + "%";
    // bar.style["right"] = (interval * (max - rowMaxTemp)) + "%";
    // row.style["margin-left"] = (interval * (rowMin - min)) + "%";
    // row.style["margin-right"] = (interval * (rowMax - max)) + "%";

    // row.appendChild(dayDiv);
    row.appendChild(bar);
    return row;
  },

  renderWeatherForecast: function () {
    var numDays =  7;
    var i;

    var filteredDays =
      this.weatherData.daily.data.filter( function(d, i) { return (i < numDays); });

    var min = Number.MAX_VALUE;
    var max = -Number.MAX_VALUE;
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      min = Math.min(min, day.temperatureMin);
      max = Math.max(max, day.temperatureMax);
    }
    min = Math.round(min);
    max = Math.round(max);

    var maxDayDivWidth = 0;
    // figure out the max width of the days and icons
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      var dayText = this.getDayFromTime(day.time);
      var dayWidth = this.getTextWidth(dayText, "forecast-day");
      var iconClass = this.config.iconTable[day.icon];
      var iconWidth = this.getTextWidth("", 'wi weathericon ' + iconClass);
      maxDayDivWidth = Math.max(maxDayDivWidth, dayWidth + iconWidth);
    }

    var display = document.createElement("div");
    display.className = "forecast";
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      var row = this.renderForecastRow(day, min, max, maxDayDivWidth);
      display.appendChild(row);
    }
    return display;
  },

  getLocation: function () {
    var self = this;
    navigator.geolocation.getCurrentPosition(
      function (location) {
        if (self.config.debug) {
          console.log("geolocation success", location);
        }
        self.config.latitude  = location.coords.latitude;
        self.config.longitude = location.coords.longitude;
        self.geoLocationLookupSuccess = true;
      },
      function (error) {
        if (self.config.debug) {
          console.log("geolocation error", error);
        }
        self.geoLocationLookupFailed = true;
        self.updateDom(self.config.animationSpeed);
      },
      this.config.geoLocationOptions);
  },

// Round the temperature based on tempDecimalPlaces
  roundTemp: function (temp) {
    var scalar = 1 << this.config.tempDecimalPlaces;

    temp *= scalar;
    temp  = Math.round( temp );
    temp /= scalar;

    return temp;
  },

  scheduleUpdate: function(delay) {
    var nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    var self = this;
    setTimeout(function() {
      self.updateWeather();
    }, nextLoad);
  }

});
