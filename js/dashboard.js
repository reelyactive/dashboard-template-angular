/**
 * Copyright reelyActive 2016-2017
 * We believe in an open Internet of Things
 */


// Constant definitions
API_ROOT = 'https://www.hyperlocalcontext.com/';
DEFAULT_SOCKET_URL = API_ROOT;
WHEREIS_TRANSMITTER_ROOT = API_ROOT + '/whereis/transmitter/';
WHATAT_RECEIVER_ROOT = API_ROOT + '/whatat/receiver/';
CONTEXTAT_DIRECTORY_ROOT = API_ROOT + '/contextat/directory/';
UPDATE_PERIOD_SECONDS = 1;
LINE_CHART_SAMPLES = 8;
LINE_CHART_SERIES = [ 'Devices', 'Displacements' ];
LINE_CHART_OPTIONS = {
  legend: {
    display: true,
    position: 'left'
  },
  scales: {
    xAxes: [{
      type: 'linear',
      position: 'bottom'
    }]
  }
};
BAR_CHART_OPTIONS = {};
DOUGHNUT_CHART_SAMPLES = 8;
DOUGHNUT_CHART_OPTIONS = {
  legend: {
    display: false
  },
  animation: {
    animateRotate: false
  }
};
LINE_CHART_COLORS = [ '#0770a2', '#ff6900', '#aec844', '#5a5a5a' ];
BAR_CHART_COLORS = [ '#0770a2', '#ff6900', '#aec844' ];
DOUGHNUT_CHART_COLORS = [ '#0770a2', '#ff6900', '#aec844', '#d0dd9e',
                          '#f8b586', '#82b6cf', '#a9a9a9', '#5a5a5a' ];


/**
 * dashboard Module
 * All of the JavaScript specific to the dashboard is contained inside this
 * angular module.  The only external dependencies are:
 * - beaver and cormorant (reelyActive)
 * - socket.io (btford)
 * - angular-chart (jtblin)
 */
angular.module('dashboard', ['btford.socket-io', 'chart.js',
                             'reelyactive.beaver', 'reelyactive.cormorant'])


/**
 * Socket Factory
 * Creates the websocket connection to the given URL using socket.io.
 */
.factory('Socket', function(socketFactory) {
  return socketFactory({
    ioSocket: io.connect(DEFAULT_SOCKET_URL)
  });
})


/**
 * DashCtrl Controller
 * Handles the manipulation of all variables accessed by the HTML view.
 */
.controller('DashCtrl', function($scope, $interval, Socket, beaver, cormorant) {

  // Variables accessible in the HTML scope
  $scope.elapsedSeconds = 0;
  $scope.devices = [];
  $scope.directories = [];
  $scope.cumStats = beaver.getStats();
  $scope.curStats = { appearances: 0, keepalives: 0,
                      displacements: 0, disappearances: 0 };
  $scope.rssi = {};
  $scope.stories = [];
  $scope.linechart = { labels: [], series: LINE_CHART_SERIES, data: [[],[]] };
  $scope.barchart = { labels: [ 'Max RSSI', 'Avg RSSI', 'Min RSSI' ], data: [] };
  $scope.doughnutchart = { labels: [], data: [] };
  $scope.lineChartColors = LINE_CHART_COLORS;
  $scope.lineChartOptions = LINE_CHART_OPTIONS;
  $scope.barChartColors = BAR_CHART_COLORS;
  $scope.barChartOptions = BAR_CHART_OPTIONS;
  $scope.doughnutChartColors = DOUGHNUT_CHART_COLORS;
  $scope.doughnutChartOptions = DOUGHNUT_CHART_OPTIONS;

  // Variables accessible in the local scope
  var devices = beaver.getDevices();
  var directories = beaver.getDirectories();
  var stories = cormorant.getStories();
  var storyStats = {};
  var rssi = { min: 255, max: 0, sum: 0, count: 0 };
  var appearances = 0;
  var keepalives = 0;
  var displacements = 0;
  var disappearances = 0;

  // beaver.js listens on the websocket for events
  beaver.listen(Socket);

  // Handle events pre-processed by beaver.js
  beaver.on('appearance', function(event) {
    appearances++;
    handleEvent('appearance', event);
  });
  beaver.on('displacement', function(event) {
    displacements++;
    handleEvent('displacement', event);
  });
  beaver.on('keep-alive', function(event) {
    keepalives++;
    handleEvent('keep-alive', event);
  });
  beaver.on('disappearance', function(event) {
    disappearances++;
    handleEvent('disappearance', event);
  });

  // Handle an event
  function handleEvent(type, event) {
    updateStories(event);
  }

  // Update the collection of stories
  function updateStories(event) {
    if(event.hasOwnProperty('deviceUrl')) {
      cormorant.getStory(event.deviceUrl, function() {
      });
    }
    if(event.hasOwnProperty('receiverUrl')) {
      cormorant.getStory(event.receiverUrl, function() {
      });
    }
  }

  // Sample the current state of all detected devices
  function sampleDevices(devices) {
    var devicesArray = [];

    for(id in devices) {
      var device = devices[id];
      device.url = WHEREIS_TRANSMITTER_ROOT + id;
      device.receiverUrl = WHATAT_RECEIVER_ROOT + device.event.receiverId;
      devicesArray.push(device);
      addStoryStat(device.event.deviceUrl);
      updateRssiStats(device.event.rssi);
    }

    return devicesArray;
  }

  // Sample the current state of the directories
  function sampleDirectories(directories) {
    var directoryArray = [];

    for(id in directories) {
      var directory = directories[id];
      directory.id = id;
      directory.receiverCount = Object.keys(directory.receivers).length;
      directory.deviceCount = Object.keys(directory.devices).length;
      directory.url = CONTEXTAT_DIRECTORY_ROOT + id;
      directoryArray.push(directory);
    }

    return directoryArray;
  }

  // Sample the stats from the previous period
  function sampleStats() {
    var stats = {
        appearances: appearances,
        keepalives: keepalives,
        displacements: displacements,
        disappearances: disappearances
    };
    appearances = 0;
    keepalives = 0;
    displacements = 0;
    disappearances = 0;
    return stats;
  }

  // Sample the RSSI from the previous period
  function sampleRssi() {
    var rssiSample = {};
    if(rssi.count > 0) {
      rssiSample = {
        min: rssi.min,
        max: rssi.max,
        avg: Math.round(rssi.sum / rssi.count),
        count: rssi.count
      };
    }
    rssi = { min: 255, max: 0, sum: 0, count: 0 };
    return rssiSample;
  }

  // Update the line chart
  function updateLineChart() {
    $scope.linechart.data[0].push( { x: $scope.elapsedSeconds,
                                     y: $scope.devices.length } );
    $scope.linechart.data[1].push( { x: $scope.elapsedSeconds,
                                     y: $scope.curStats.displacements } );
    if($scope.linechart.data[0].length > LINE_CHART_SAMPLES) {
      $scope.linechart.data[0].shift();
      $scope.linechart.data[1].shift();
    }
  }

  // Update the bar chart
  function updateBarChart() {
    $scope.barchart.data = [ $scope.rssi.max, $scope.rssi.avg, $scope.rssi.min ];
  }

  // Update the doughnut chart
  function updateDoughnutChart() {
    var labels = [];
    var data = [];
    var storyStatsArray = Object.values(storyStats);
    var sampleLimit = Math.min(storyStatsArray.length, DOUGHNUT_CHART_SAMPLES);
    var cStory = 0;
    var otherCount = 0;

    function compare(a,b) {
      if(a.count < b.count) return 1;
      if(a.count > b.count) return -1;
      return 0;
    }

    storyStatsArray.sort(compare);

    for(cStory = 0; cStory < (sampleLimit - 1); cStory++) {
      labels.push(storyStatsArray[cStory].type);
      data.push(storyStatsArray[cStory].count);
    }
    while(cStory < storyStatsArray.length) {
      otherCount += storyStatsArray[cStory++].count;
    }
    labels.push('All others');
    data.push(otherCount);

    $scope.stories = storyStatsArray.slice(0, sampleLimit - 1);
    $scope.stories.push( { type: 'All others', count: otherCount } );

    $scope.doughnutchart.labels = labels;
    $scope.doughnutchart.data = data;

  }

  // Add the given story URL to the statistics
  function addStoryStat(url) {
    if(storyStats.hasOwnProperty(url)) {
      storyStats[url].count++;
    }
    else {
      var type = url;
      if(type.indexOf('Organization') >= 0) {
        type = type.substr(type.indexOf('Organization'));
      }
      else if(type.indexOf('Product') >= 0) {
        type = type.substr(type.indexOf('Product'));
      }
      storyStats[url] = { type: type, count: 1, url: url };
    }
  }

  // Add the device RSSI to the statistics
  function updateRssiStats(deviceRssi) {
    if(deviceRssi < rssi.min) {
      rssi.min = deviceRssi;
    }
    else if(deviceRssi > rssi.max) {
      rssi.max = deviceRssi;
    }
    rssi.sum += deviceRssi;
    rssi.count++;
  }

  // Periodic update of display variables
  function periodicUpdate() {
    storyStats = {};
    $scope.elapsedSeconds += UPDATE_PERIOD_SECONDS;
    $scope.devices = sampleDevices(devices);
    $scope.directories = sampleDirectories(directories);
    $scope.curStats = sampleStats();
    $scope.rssi = sampleRssi();
    updateLineChart();
    updateBarChart();
    updateDoughnutChart();
  }

  $interval(periodicUpdate, UPDATE_PERIOD_SECONDS * 1000);
});
