import path from 'path';
import fs from 'fs';
import express from 'express';
import webdriver from 'selenium-webdriver';
import chai, {expect} from 'chai';
import dirtyChai from 'dirty-chai';
import golden from './golden';

chai.use(dirtyChai);

const By = webdriver.By;
const Key = webdriver.Key;
const until = webdriver.until;

const driver = new webdriver.Builder()
  .forBrowser('chrome')
  .build();

const cfg = {
  url: null, // 'http://miew.opensource.epam.com/master/',
  localPath: path.resolve(__dirname, '../../build'),
  port: 8008,
  window: {width: 1024, height: 768},
  timeout: 5000,
  threshold: 1,
  dom: {
    canvas: By.css('.miew-canvas canvas'),
    title: By.css('span[data-field="title"]'),
    terminal: {
      button: By.id('miew-terminal-btn'),
      clipboard: By.css('.terminal-wrapper textarea.clipboard'),
      command: By.css('.terminal-output .command'),
    },
  },
};

let server = null;

function untilRepresentationIs(mode, colorer) {
  return () => driver.executeScript(`\
var miew = window && window.MIEWS && window.MIEWS[0];
var rep = miew && miew.repGet(0);
var modeOk = rep && (rep.mode.id === '${mode.toUpperCase()}');
var colorerOk = rep && (rep.colorer.id === '${colorer.toUpperCase()}');
return modeOk && colorerOk && !miew._needRebuild() && !miew._needRender;`);
}

function untilRebuildIsDone() {
  return () => driver.executeScript(`\
var miew = window.MIEWS && window.MIEWS[0];
var rep = miew && miew.repGet(0);
return rep && !miew._needRebuild() && !miew._needRender;`);
}

describe('Miew demo application', function() {

  this.timeout(0);

  before(function(done) {
    golden.use(driver);
    golden.report.begin(this.test.parent.title);
    golden.report.data.threshold = cfg.threshold;

    function startBrowser(host) {
      const getPadding = 'return[window.outerWidth-window.innerWidth,window.outerHeight-window.innerHeight];';
      driver.executeScript(getPadding).then((pad) => {
        return driver.manage().window().setSize(cfg.window.width + pad[0], cfg.window.height + pad[1]);
      });
      driver.navigate().to(host);
      driver.wait(until.elementLocated(cfg.dom.canvas));
      driver.getCapabilities().then((caps) => {
        const browserName = caps.get('browserName').replace(/\b\w/g, c => c.toUpperCase());
        const version = caps.get('version') || caps.get('browserVersion') || '(unknown version)';
        const platform = caps.get('platform') || caps.get('platformName') || 'unspecified platform';
        golden.report.data.browser = `${browserName} ${version} for ${platform}`;
      });
      driver.getCurrentUrl().then((url) => {
        golden.report.data.url = url;
      });
      driver.executeScript(() => window.MIEWS[0].VERSION).then((version) => {
        golden.report.data.version = version;
        done();
      });
    }

    if (cfg.url) {
      startBrowser(cfg.url);
    } else {
      if (!fs.existsSync(path.join(cfg.localPath, 'index.html'))) {
        throw new URIError(`App is not found in ${cfg.localPath}, did you forget to build it?`);
      }
      const app = express();
      app.use('/', express.static(cfg.localPath));
      server = app.listen(cfg.port, () => {
        startBrowser(`http://localhost:${cfg.port}`);
      });
    }
  });

  beforeEach(function() {
    golden.report.context.desc = this.currentTest.title;
  });

  afterEach(function() {
    golden.report.context.desc = 'N/A';
  });

  after(() => {
    return driver.quit().then(() => {
      if (server) {
        server.close();
      }
      golden.report.end();
    });
  });

  it('shows 1CRN correctly at the start', function() {
    const title = driver.findElement(cfg.dom.title);
    return driver.wait(until.elementTextContains(title, '1CRN'), cfg.timeout)
      .then(() => golden.shouldMatch('1crn', this));
  });

  it('accepts a command in terminal', function() {
    const command = 'rep 0 m=BS c=EL';
    driver.findElement(cfg.dom.terminal.button).click();
    driver.wait(until.elementLocated(cfg.dom.terminal.clipboard)).sendKeys(command + Key.ENTER);
    return driver.wait(until.elementLocated(cfg.dom.terminal.command), cfg.timeout).getText().then((text) => {
      // http://www.adamkoch.com/2009/07/25/white-space-and-character-160/
      expect(text.replace(/\s/g, ' ')).to.equal('miew> ' + command);
    });
  });

  it('changes representation to Balls and Sticks', function() {
    const title = driver.findElement(cfg.dom.title);
    return driver.wait(until.elementTextContains(title, 'Balls and Sticks'), cfg.timeout)
      .then(() => golden.shouldMatch('1crn_bs', this));
  });

  describe('for 1AID', function() {

    it('loads and sets the "small" preset', function() {
      const command = `\
set autoPreset 0
set interpolateViews false
load 1AID
view "18KeRwuF6IsJGtmPAkO9IPZrOGD9xy0I/ku/APQ=="
preset small`;
      const keys = command.replace(/\n/g, Key.chord(Key.SHIFT, Key.ENTER)) + Key.ENTER;
      driver.findElement(cfg.dom.terminal.clipboard).sendKeys(keys);
      const title = driver.findElement(cfg.dom.title);
      driver.wait(until.elementTextContains(title, '1AID'), cfg.timeout);
      return driver.wait(untilRebuildIsDone(), cfg.timeout)
        .then(() => golden.shouldMatch('1aid', this));
    });

    const modes = ['LN', 'LC', 'BS', 'VW', 'TR', 'TU', 'CA', 'QS', 'SA', 'SE', 'CS'];
    const colorers = ['EL', 'RT', 'SQ', 'CH', 'SS', 'UN', 'CO', 'CF', 'TM', 'OC', 'HY', 'MO'];

    modes.forEach((mode) => {
      colorers.forEach((colorer) => {
        const command = `rep 0 m=${mode} c=${colorer}`;
        it(`applies "${command}"`, function() {
          driver.findElement(cfg.dom.terminal.clipboard).sendKeys(command + Key.ENTER);
          return driver.wait(untilRepresentationIs(mode, colorer), cfg.timeout)
            .then(() => golden.shouldMatch(`1aid_${mode}_${colorer}`, this));
        });
      });
    });

  });

});