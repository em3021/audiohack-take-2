(function() {
  var App;

  App = (function() {
    function App(options) {
      var defaults = {};
      this.options = $.extend(defaults, options);
      this.init();
    }

    App.prototype.init = function(){
      var _this = this;

      this.audioContext = new AudioContext();
      this.audioInput = null;
      this.realAudioInput = null;
      this.inputPoint = null;
      this.audioRecorder = null;
      this.rafID = null;
      this.analyserContext = null;
      this.recIndex = 0;

      this.initAudio();
      this.initListeners();
    };

    App.prototype.gotBuffers = function(buffers) {
      var $el = $('<li><canvas></canvas><div class="buttons"><button class="play"></button><button class="reset">Try Again</button></div></li>');
      $('#recordings').empty().append($el);

      var canvas = $el.find('canvas')[0];

      drawBuffer(canvas.width, canvas.height, canvas.getContext('2d'), buffers[0]);

      // audioRecorder.exportWAV(doneEncoding);
    };

    App.prototype.gotStream = function(stream) {
      var inputPoint = this.audioContext.createGain();

      // Create an AudioNode from the stream.
      var realAudioInput = this.audioContext.createMediaStreamSource(stream);
      var audioInput = realAudioInput;
      audioInput.connect(inputPoint);

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      inputPoint.connect(this.analyserNode);

      this.audioRecorder = new Recorder(inputPoint);

      var zeroGain = this.audioContext.createGain();
      zeroGain.gain.value = 0.0;
      inputPoint.connect(zeroGain);
      zeroGain.connect(this.audioContext.destination);
      this.updateAnalysers();
    };

    App.prototype.initAudio = function() {
      var _this = this;

      if (!navigator.getUserMedia)
        navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
      if (!navigator.cancelAnimationFrame)
        navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
      if (!navigator.requestAnimationFrame)
        navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

      navigator.getUserMedia({
        "audio": {
          "mandatory": {
          "googEchoCancellation": "false",
          "googAutoGainControl": "false",
          "googNoiseSuppression": "false",
          "googHighpassFilter": "false"
        },
          "optional": []
        },
      }, function(stream){
        _this.gotStream(stream);

      }, function(e) {
        alert('Error getting audio');
        console.log(e);
      });
    };

    App.prototype.initListeners = function(){
      var _this = this;

      $('#record').on('click', function(e){
        e.preventDefault();
        var $record = $(this).closest('.record-area');
        $record.toggleClass('active');
        if ($record.hasClass('active')) {
          _this.recordStart();
        } else {
          _this.recordStop();
        }

      });

      $('#recordings').on('click', '.play', function(e){
        e.preventDefault();
        _this.recordingPlay();
      });

      $('#recordings').on('click', '.reset', function(e){
        e.preventDefault();
        $('#recordings').empty();
        $('.submit').addClass('hide');
      });

      $('input[name="url"]').on('blur', function(){
        _this.lookupURL($(this).val());
      });
    };

    App.prototype.lookupURL = function(url){
      $.getJSONP("http://knomad.parseapp.com/episodeLookUp", {link: url}, function(data) {
        var $el = $('<div class="card"><img src="'+data.showImageUrl+'" /><div class="title">'+data.episodeTitle+'</div></div>');
        $('#preview').append($el);
        // episodeAudioVideoUrl: "http://www.podtrac.com/pts/redirect.mp3/traffic.libsyn.com/nerdist/Nerdist_725_-_Sir_Patrick_Stewart_Returns.mp3",
        // episodeTitle: "Sir Patrick Stewart Returns",
        // showImageUrl: "http://is1.mzstatic.com/image/thumb/Podcasts3/v4/63/cf/5a/63cf5afb-2dae-c24e-6a80-ad2db7b46568/mza_2280581886263906275.jpg/600x600bb-85.jpg",
        // showTitle: "Nerdist",
        // showUrl: "http://nerdist.com"
      });
    };

    App.prototype.recordingPlay = function(){
      var audio = $('#audio-playback')[0];
      audio.currentTime = 0;
      audio.play();

      $('#recordings .play').addClass('active');
      audio.addEventListener('ended', function(){
        $('#recordings .play').removeClass('active');
      });
    };

    App.prototype.recordStart = function() {
      this.audioRecorder.clear();
      this.audioRecorder.record();
    };

    App.prototype.recordStop = function() {
      var _this = this;

      $('.submit').removeClass('hide');

      this.audioRecorder.stop();
      this.audioRecorder.exportWAV(function(blob){
        window.URL = window.URL || window.webkitURL;
        $('#audio-playback')[0].src = window.URL.createObjectURL(blob);

        _this.audioRecorder.getBuffers(function(buffers){
          _this.gotBuffers(buffers);
        });
      });

    };

    App.prototype.updateAnalysers = function(time) {
      var _this = this;

      if (!this.analyserContext) {
        var canvas = $("#analyser")[0];
        this.canvasWidth = canvas.width;
        this.canvasHeight = canvas.height;
        this.analyserContext = canvas.getContext('2d');
      }

      // analyzer draw code here
      var SPACING = 3;
      var BAR_WIDTH = 1;
      var numBars = Math.round(this.canvasWidth / SPACING);
      var freqByteData = new Uint8Array(this.analyserNode.frequencyBinCount);

      this.analyserNode.getByteFrequencyData(freqByteData);

      this.analyserContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
      this.analyserContext.fillStyle = '#F6D565';
      this.analyserContext.lineCap = 'round';
      var multiplier = this.analyserNode.frequencyBinCount / numBars;

      // Draw rectangle for each frequency bin.
      for (var i = 0; i < numBars; ++i) {
          var magnitude = 0;
          var offset = Math.floor( i * multiplier );
          // gotta sum/average the block, or we miss narrow-bandwidth spikes
          for (var j = 0; j< multiplier; j++)
              magnitude += freqByteData[offset + j];
          magnitude = magnitude / multiplier;
          var magnitude2 = freqByteData[i * multiplier];
          this.analyserContext.fillStyle = "hsl( " + Math.round((i*360)/numBars) + ", 100%, 50%)";
          this.analyserContext.fillRect(i * SPACING, this.canvasHeight, BAR_WIDTH, -magnitude);
      }


      this.rafID = window.requestAnimationFrame(function(time){
        _this.updateAnalysers(time);
      });
    };

    return App;

  })();

  $(function() {
    return new App({});
  });

}).call(this);
