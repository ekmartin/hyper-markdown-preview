const { existsSync, readFileSync } = require('fs');
const { exec } = require('child_process');
const { resolve } = require('path');

const Remarkable = require('remarkable');

const resolveCWD = (pid, cb) => 
 exec(`lsof -p ${pid} | grep cwd | tr -s ' ' | cut -d ' ' -f9-`, (err, cwd) => {
    if (err) {
      cb(err, null);
    } else {
      cwd = cwd.trim();
      cb(null, cwd);
    }
  });


exports.middleware = (store) => (next) => (action) => {

  const notFound = /(?:ba)?sh: ((?:https?:\/\/)|(?:file:\/\/)|(?:\/\/))?(.*): (?:(?:command not found)|(?:No such file or directory))/;
 
  if ('SESSION_ADD_DATA' === action.type) {
    const { data } = action;
    const match = data.match(notFound);
    const { sessions } = store.getState();
    const { activeUid } = sessions;
    const session = sessions.sessions[activeUid];
    const { pid } = session;

    if (match) {
      const file = match[2];
      if (/\.(md|markdown)$/.test(file)) {
          resolveCWD(pid, (err, cwd) => {
            const path = resolve(cwd, file);
            if (existsSync(path)) {
              const source = readFileSync(path, 'UTF-8');
              store.dispatch({
                type: 'SESSION_URL_SET',
                uid: activeUid,
                url: URL.createObjectURL(new Blob([
                  new Remarkable({html: true}).render(source)
                ],{type: 'text/html'}))
              });
            } else {
              next(action);
            }
          });
      } else {
        next(action);
      }
    } else {
      next(action);
    }
  } else {
    next(action);
  }
};

exports.reduceUI = (state, action) => {
  switch (action.type) {
    case 'RENDER_MARKDOWN':
      const uid = state.activeUid;
      return state.setIn(['sessions', uid, 'url'], action.url);
  }
  return state;
};