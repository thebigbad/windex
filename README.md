While doing Firefox extension development, I wanted to use [jQuery](http://jquery.com/). There were a few obstacles to just adding it to my overlay:

*   jQuery expects a vanilla HTML window and document. Whatever ChromeWindows are, they are not vanilla:

        alert(document.body === undefined) // true


*   jQuery doesn't care about interference from other scripts. Specifically, jQuery does not expect other scripts to booby trap the DOM:

        // a nefarious other script
        Node.prototype.getAttribute = function () { alert('vuvuzela!') };
        // later on in our code
        $('#footer').attr('theme'); // yup. vuvuzela.

    That particular example is contrived, but consider the mangling that occurs when one of those frameworks that got the brilliant idea to alter the prototype of Array and String.

    And contrived or not, pages that wish to interfere with your extension have a high degree of control over the nodes on thier pages.

*   jQuery development is most ergonomic when you don't have to specify the context with every call to $. But with n ChromeWindows and n tabs, that's pretty much the breaks for you.

Windex
============

Windex is a CommonJS Module that provides a knockoff of jQuery for Firefox extension development. It features:

* Runs happily from the Firefox JSM enviroment or a content script--no need to build a safe HTMLDocument nest for it.
* Safely interrogates DOMs under enemy control--uses Firefox's [XPCNativeWrapper](https://developer.mozilla.org/en/XPCNativeWrapper).
* Allows you to control the default context--exposes a $.defaultContext() that you can set to return whatever context fits your use case.
* The same API as jQuery (modulo TODOs)--your developers can write like they're working on a regular website.
* The source is good for learning about advanced topics like event delegation--it's way easier to read than jQuery source because it does less and I haven't needed to give a fig about performance.

We've been using it in production for a few months. I was starting another project that needed jQuery and getting ready to copy and paste it over when I thought: "If this is useful enough to me in more than one project, it would probably be useful for someone else."

Usage
===========

First, you'll need to get CommonJS working in your extension: borderstylo/commonjs-ffext is how we're doing it.

Then, copy windex.js into one of your require paths.

    var $ = require('windex');

    $('#header', gBrowser.contentDocument.body).toggle();

    // optionally, specify the default context
    // this one uses the last selected tab's body
    $.defaultContext = function () {
      var windowManager = Cc["@mozilla.org/appshell/window-mediator;1"].
        getService(Ci.nsIWindowMediator);
      var chromeWindow = windowManager.getMostRecentWindow("navigator:browser");
      var document = chromeWindow.gBrowser.contentDocument;
      return document.body;
    };

    $('#header').toggle(); // is now equivelent to the first call

TODO
===========

jQuery has a lot of methods, and each one takes a lot of different kinds of arguments. Windex has enough methods and enough variations on arguments for me, but new methods and argument handling will be added in as myself or my coworkers need more. One notable missing part is animations--patches welcome :)

I stripped $.ajax because it depended on some other libs in my project, but I'll need to add that back in the next week so project #2 will have it.

License
============

Windex is licensed under the MIT license.
