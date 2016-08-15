/**
 * Copyright reelyActive 2016
 * We believe in an open Internet of Things
 */


// Constant definitions
DEFAULT_SOCKET_URL = 'http://www.hyperlocalcontext.com/notman';
EVENT_HISTORY = 4;


/**
 * dashboard Module
 * All of the JavaScript specific to the dashboard is contained inside this
 * angular module.  The only external dependencies are:
 * - beaver, cormorant and cuttlefish (reelyActive)
 * - socket.io (btford)
 * - ngSanitize (angular)
 */
angular.module('dashboard', ['btford.socket-io', 'reelyactive.beaver',
                             'reelyactive.cormorant',
                             'reelyactive.cuttlefish', 'ngSanitize'])


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
.controller('DashCtrl', function($scope, Socket, beaver, cormorant) {

  // Variables accessible in the HTML scope
  $scope.devices = beaver.getDevices();
  $scope.stats = beaver.getStats();
  $scope.stories = cormorant.getStories();
  $scope.selectedStory = 'Select a story from the list';
  $scope.selectedUrl = null;
  $scope.events = [];

  // beaver.js listens on the websocket for events
  beaver.listen(Socket);

  // Handle events pre-processed by beaver.js
  beaver.on('appearance', function(event) {
    handleEvent('appearance', event);
  });
  beaver.on('displacement', function(event) {
    handleEvent('displacement', event);
  });
  beaver.on('keep-alive', function(event) {
    handleEvent('keep-alive', event);
  });
  beaver.on('disappearance', function(event) {
    handleEvent('disappearance', event);
  });

  // Handle an event
  function handleEvent(type, event) {
    updateEvents(type, event);
    updateStories(event);
  }

  // Update the event array (first in, first out)
  function updateEvents(type, event) {
    var length = $scope.events.unshift(event);
    if (length > EVENT_HISTORY) {
      $scope.events.pop();
    }
  }

  // Update the collection of stories
  function updateStories(event) {
    if(event.hasOwnProperty('deviceUrl')) {
      cormorant.getStory(event.deviceUrl, function() {
        selectFirstStory();
      });
    }
    if(event.hasOwnProperty('receiverUrl')) {
      cormorant.getStory(event.receiverUrl, function() {
        selectFirstStory();
      });
    }
  }

  // Automatically select the first story
  function selectFirstStory() {
    var urls = Object.keys($scope.stories);
    if(urls.length === 1) {
      $scope.selectStory(urls[0]);
    }
  }

  // Update the selected story
  $scope.selectStory = function(url) {
    $scope.selectedStory = JSON.stringify($scope.stories[url], null, "  ");
    $scope.selectedUrl = url;
  }
});
