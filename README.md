### Colloquy
Virgilio messaging and data push server.

#### Deploy

    bundle install
    cap deploy:setup (solo la prima volta)
    cap deploy

Il deploy installa le dipendenze specificate nel package.json e automaticamente fa restart del task di upstart.
La conf di upstart viene creata e/o aggiornata on the fly.
Il deploy è fatto con :
https://github.com/loopj/capistrano-node-deploy
Dettagli di environment sono da specificare nel file *Capfile*

