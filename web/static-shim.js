// Hosted build only: the dashboard's live streams (/api/.../events) come from a server that
// isn't there. This stands in for EventSource with the recorded event log, so a finished run
// renders as-is, and ?replay=<speed> plays it back as it happened.
(function () {
  var params = new URLSearchParams(location.search);
  var isReplay = params.has('replay');
  var speedVal = Number(params.get('replay')) || (isReplay ? 1 : 0);

  window.__firstrunReplay = {
    active: isReplay,
    speed: speedVal || 1,
    paused: false,
    instance: null,
    setSpeed: function (s) {
      this.speed = s;
      var url = new URL(location.href);
      url.searchParams.set('replay', s);
      history.replaceState(null, '', url.href);
      if (this.instance) this.instance.speed = s;
      window.dispatchEvent(new CustomEvent('replaychange'));
    },
    togglePause: function () {
      this.paused = !this.paused;
      if (this.instance) this.instance.paused = this.paused;
      window.dispatchEvent(new CustomEvent('replaychange'));
    },
    restart: function () {
      if (this.instance) this.instance.restart();
      window.dispatchEvent(new CustomEvent('replaychange'));
    }
  };

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  class RecordedEventSource extends EventTarget {
    constructor(url) {
      super();
      this.url = url;
      this.readyState = 0;
      this.onmessage = null;
      this.onerror = null;
      this.closed = false;
      this.speed = window.__firstrunReplay.active ? window.__firstrunReplay.speed : (Number(params.get('replay')) || 0);
      this.paused = window.__firstrunReplay.paused;
      if (window.__firstrunReplay.active) window.__firstrunReplay.instance = this;
      this.start(url);
    }
    emit(type, data) {
      if (this.closed) return;
      var ev = new MessageEvent(type, { data: data });
      if (type === 'message' && this.onmessage) this.onmessage(ev);
      this.dispatchEvent(ev);
    }
    async restart() {
      this.closed = false;
      this.emit('reset', '{}');
      this.start(this.url);
    }
    async start(url) {
      await sleep(0);
      var m = url.match(/\/api\/(runs|audits)\/(.+)\/events/);
      if (!m) { if (this.onerror) this.onerror(new Event('error')); return; }
      var id = decodeURIComponent(m[2]);
      try {
        if (m[1] === 'audits') {
          var audit = await (await fetch('/data/audits/' + encodeURIComponent(id) + '.json')).text();
          this.readyState = 1;
          this.emit('snapshot', audit);
          this.emit('ready', '{}');
          return;
        }
        var text = await (await fetch('/data/runs/' + encodeURIComponent(id) + '/f/events.ndjson')).text();
        var lines = text.split('\n').filter(Boolean);
        this.readyState = 1;
        if (!this.speed) {
          for (var i = 0; i < lines.length; i++) this.emit('message', lines[i]);
          this.emit('ready', '{}');
          return;
        }
        this.emit('ready', '{}');
        var prev = null, t0 = null, now0 = Date.now();
        for (var j = 0; j < lines.length && !this.closed; j++) {
          while (this.paused && !this.closed) {
            await sleep(100);
          }
          if (this.closed) break;
          var line = lines[j], t = null;
          try {
            var ev = JSON.parse(line);
            t = Date.parse(ev.t);
            if (t) {
              if (t0 == null) t0 = t;
              var curSpeed = this.speed || 1;
              ev.t = new Date(now0 + (t - t0) / curSpeed).toISOString();
              if (ev.data && ev.data.startedAt) ev.data.startedAt = ev.t;
              line = JSON.stringify(ev);
            }
          } catch (e) {}
          if (prev != null && t) {
            var delay = (t - prev) / (this.speed || 1);
            var remaining = Math.min(1500, Math.max(0, delay));
            while (remaining > 0 && !this.closed) {
              if (this.paused) {
                while (this.paused && !this.closed) await sleep(100);
              }
              var chunk = Math.min(100, remaining);
              await sleep(chunk);
              remaining -= chunk;
            }
          }
          if (t) prev = t;
          if (!this.closed) this.emit('message', line);
        }
      } catch (e) {
        if (this.onerror) this.onerror(new Event('error'));
      }
    }
    close() { this.closed = true; this.readyState = 2; }
  }
  window.EventSource = RecordedEventSource;

  if (speedVal || isReplay) {
    var realFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var u = typeof input === 'string' ? input : input.url;
      var m = u.match(/^\/api\/runs\/([^/?]+)$/);
      if (m) return Promise.resolve(new Response(JSON.stringify({ id: decodeURIComponent(m[1]) }), { headers: { 'Content-Type': 'application/json' } }));
      return realFetch(input, init);
    };
  }
})();
