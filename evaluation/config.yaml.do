
ask() {
  echo $1
  echo -n '> '
}

ask "Where is peregrine JSON API running?"
read peregrine
echo "peregrine: $peregrine" >> $3

while [ ! -e "$thinfrequencies" ]; do
  ask "Where is THIN frequencies file?"
  read thinfrequencies
done
echo "thinfrequencies: $thinfrequencies" >> $3
