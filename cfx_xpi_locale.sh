#!/bin/sh
#
# Post process the generated XPI file created by `cfx xpi`
# to work around the issues described in this bugreport:
# https://bugzilla.mozilla.org/show_bug.cgi?id=661083
#

# Don't pacakge .patchdir in the new XPI
if [ -e ".patchdir" ]; then
    rm -rf .patchdir/
fi

# Create and extract XPI
cfx xpi
unzip -qo voipgrid.xpi -d.patchdir/

# Apply patch
cd .patchdir
patch -p1 install.rdf < ../xpi_locale.patch
rm -f ../voipgrid.xpi

# Create new XPI
zip -q ../voipgrid.xpi -r .
cd ..

rm -rf .patchdir/

echo "patching complete!"
