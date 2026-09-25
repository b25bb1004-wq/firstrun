// Hosted build only: the dashboard's live streams (/api/.../events) come from a server that
// isn't there. This stands in for EventSource with the recorded event log, so a finished run
// renders as-is, and ?replay=<speed> plays it back as it happened.
(function () {
  var params = new URLSearchParams(location.search);
  var speed = Number(params.get('replay')) || 0;
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  class RecordedEventSource extends EventTarget {
    constructor(url) {
      super();
      this.url = url;
      this.readyState = 0;
      this.onmessage = null;
      this.onerror = null;
      this.closed = false;
      this.start(url);
    }
    emit(type, data) {
      if (this.closed) return;
      var ev = new MessageEvent(type, { data: data });
      if (type === 'message' && this.onmessage) this.onmessage(ev);
      this.dispatchEvent(ev);
    }
    async start(url) {
      await sleep(0);
      var m = url.match(/\/api\/(runs|audits)\/([^/]+)\/events/);
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
        if (!speed) {
          for (var i = 0; i < lines.length; i++) this.emit('message', lines[i]);
          this.emit('ready', '{}');
          return;
        }
        this.emit('ready', '{}');
        // Timestamps are moved to "now" (and compressed by speed) so the run clock reads true.
        var prev = null, t0 = null, now0 = Date.now();
        for (var j = 0; j < lines.length && !this.closed; j++) {
          var line = lines[j], t = null;
          try {
            var ev = JSON.parse(line);
            t = Date.parse(ev.t);
            if (t) {
              if (t0 == null) t0 = t;
              ev.t = new Date(now0 + (t - t0) / speed).toISOString();
              if (ev.data && ev.data.startedAt) ev.data.startedAt = ev.t;
              line = JSON.stringify(ev);
            }
          } catch (e) {}
          if (prev != null && t) await sleep(Math.min(1500, Math.max(0, (t - prev) / speed)));
          if (t) prev = t;
          this.emit('message', line);
        }
      } catch (e) {
        if (this.onerror) this.onerror(new Event('error'));
      }
    }
    close() { this.closed = true; this.readyState = 2; }
  }
  window.EventSource = RecordedEventSource;

  // Replay starts from an empty run, not the finished run.json.
  if (speed) {
    var realFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var u = typeof input === 'string' ? input : input.url;
      var m = u.match(/^\/api\/runs\/([^/?]+)$/);
      if (m) return Promise.resolve(new Response(JSON.stringify({ id: decodeURIComponent(m[1]) }), { headers: { 'Content-Type': 'application/json' } }));
      return realFetch(input, init);
    };
  }
})();
