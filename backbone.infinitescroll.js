(function(global) {
    // Grab the DOM library Backbone is using, 0.9.2 doesn't
    // expose this as a property anymore so we mimic their
    // selection logic here
    var $ = global.jQuery || global.Zepto || global.ender;

    var Backbone = global.Backbone,
        _ = global._,
        _d = $(document);

    // Constants
    var REACHING_BOTTOM_TRIGGER = 'infinitescroll-reachingbottom';

    // Load backbone and underscore if required
    if (!_) {
        _ = typeof require !== 'undefined' && require('underscore');
        if (!_) throw new Error("Can't find underscore");
    }

    if (!Backbone) {
        Backbone = typeof require !== 'undefined' && require('backbone');
        if (!Backbone) throw new Error("Can't find Backbone");
    }

    // Reusable scroll monitor object
    //
    // el is the element to monitor scrolling on
    // heightElement is the element to measure visible height on
    //      (ie document needs to measure visible area of body)
    var ScrollMonitor = function(el, heightElement) {
        var _el = $(el),
            _hghtEl = (typeof heightElement == undefined) ? _el : $(heightElement),
            subscribers = [];

        // The scroll event logic
        var lastPosition = 0,
            lastScrollTime = 0,
            throttleCount = 0,
            currentScrollSpeed = 0;

        $(_el).on('scroll', function() {
            if (throttleCount++ == 3) {
                currentScrollSpeed = 1000 * (_el.scrollTop() - lastPosition) /
                                                (+new Date() - lastScrollTime);

                // Assume we'll scroll the same speed for 0.7 seconds,
                // if this amount is greater than the amount of page left
                // trigger the infinite scroll method
                //
                // This will work in most cases, however if we're scrolling very slowly
                // this won't be perfect and thus we'll have to fall back on
                // a direct pixel method
                if (currentScrollSpeed > 0 && (
                    (_el.height() - _el.scrollTop() < currentScrollSpeed * 0.7 && _el.scrollTop() > _el.height() / 2)
                    || _el.height() - (_el.scrollTop() + _hghtEl.get(0).clientHeight) < 150
                )) { _.each(subscribers, function(i) { i.trigger(REACHING_BOTTOM_TRIGGER); }); }

                lastScrollTime = +new Date();
                lastPosition = _el.scrollTop();
                throttleCount = 0;
            }
        });


        /* PUBLIC FUNCTIONS */

        this.getEl = function() { return _el; }

        // Add a view to the list of views subscribed
        // to this monitor's scroll notifications
        this.addSubscriber = function(obj) { subscribers.push(obj); }

        return this;
    };

    // Store a hash of elements to scroll monitors so we
    // can prevent having multiple monitors running on
    // the same element
    var monitors = {};

    // Hook into backbone
    var old = Backbone.View.prototype;
    Backbone.View = Backbone.View.extend({
        constructor: function(options) {
            if (typeof this.events == undefined) { this.events = {}; }
            if (typeof this.infiniteScrollMethod == undefined) { this.infiniteScrollMethod = "loadNextPage" }

            // Subscribe to scroll events if the view has
            // been configured to do so
            //
            // Options:
            //      documentScroll: true if the entire page should be monitored
            //      elementScroll:  true to monitor the view's el
            //                      or a string representing the selector
            if (typeof this.documentScroll == true) {
                monitors[document].addSubscriber(this);

                // Hook up trigger to function referenced
                // by this.documentScroll (String)
                this.on(REACHING_BOTTOM_TRIGGER, this[this.infiniteScrollMethod]);
            } else if (typeof this.elementScroll != undefined) {
                if (typeof this.elementScroll == true) {
                    // Use the view's el

                    monitors[this.el] = monitors[this.el] || new ScrollMonitor(this.el);
                    monitors[this.el].addSubscriber(this);
                } else {
                    // Treat elementScroll as a selector

                    var tmpEl = $(this.elementScroll).get(0);
                    monitors[tmpEl] = monitors[tmpEl] || new ScrollMonitor(tmpEl)
                }
            }

            old.constructor.call(this, options);
        }
    });

    // Load DOM elements we need as soon as we can
    $(function() {
        monitors[document] = new ScrollMonitor(document, 'body');
    });
})(window);
