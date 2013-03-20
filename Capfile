require "capistrano/node-deploy"

set :application, "colloquy"
set :repository,  "git@git.fractalgarden.org:colloquy.git"
set :user, "rails"
set :scm, :git
set :deploy_to, "/srv/www/colloquy"
set :upstart_job_name, "colloquy"
set :node_binary, "/usr/local/bin/node"
set :node_user, "rails"

role :app, "virgilio.sunsystem.it"