Contributing
============

See the Pallets `detailed contributing documentation <contrib_>`_ for many ways
to contribute, including reporting issues, requesting features, asking or
answering questions, and making PRs.

.. _contrib: https://palletsprojects.com/contributing/


Development Setup
-----------------

Create a virtualenv and activate it::

    $ python3 -m venv .venv
    $ . .venv/bin/activate

Install development requirements::

    $ pip install -r requirements/dev.txt

Install Flask in editable mode::

    $ pip install -e .

Run tests::

    $ pytest