VoIPGRID's Click-to-Dial Firefox add-on
=======================================

Dial phone numbers from your browser with just a click using your user account on VoIPGRID's platform.

Features
--------

 * Dial phone numbers directly from your web browser.
 * Change your active user destination.
 * Keep a close watch on the number of people in your queues.

Documentation
-------------

The documentation available on how to use this add-on can be found at our [public wiki](http://wiki.voipgrid.nl/index.php/Firefox_plugin) (currently only available in Dutch).

If you want to know to contribute, please see [Contribute](#contribute).

Contribute
----------

Fork our repository to start contributing. Next, make sure you've followed the instructions at [developer.mozilla.org](https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation) to install and activate the Firefox add-on SDK.
This should get you started right away. To run the add-on in your local firefox, run:

```
$ cfx run
```

This will open a Firefox window running the add-on from source.

When you've finished developing a new feature you can package the add-on, ready to upload it to Mozilla, with:

```
$ ./cfx_xpi_locale.sh
```

This will run `cfx xpi` to package the add-on and deal with bug [#661083](https://bugzilla.mozilla.org/show_bug.cgi?id=661083).

When you have everything you want to add or change in your own github repository you can create a pull-request to request merging your changes into our add-on.


Licensing
---------

Please see the file called [LICENSE.md](LICENSE.md).

